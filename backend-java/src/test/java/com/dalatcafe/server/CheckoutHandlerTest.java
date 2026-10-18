package com.dalatcafe.server;

import com.dalatcafe.dao.InMemoryCustomerDao;
import com.dalatcafe.dao.InMemoryDatabase;
import com.dalatcafe.dao.InMemoryMenuDao;
import com.dalatcafe.dao.InMemoryOrderDao;
import com.dalatcafe.dao.InMemoryTableDao;
import com.dalatcafe.model.Customer;
import com.dalatcafe.model.MenuItem;
import com.dalatcafe.model.Order;
import com.dalatcafe.model.PaymentMethod;
import com.dalatcafe.patterns.builder.OrderBuilder;
import com.dalatcafe.patterns.decorator.BaseCoffee;
import com.dalatcafe.patterns.facade.PosCheckoutFacade;
import com.dalatcafe.patterns.observer.OrderEventSubject;
import com.dalatcafe.patterns.singleton.SystemConfigManager;
import com.dalatcafe.util.Json;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;

/** Checkout against a customer DAO that hands out copies, as the JDBC DAO does. */
class CheckoutHandlerTest {
    private static final int DRINK_ID = 901;
    private static final String PHONE = "0988000333";
    private static final int BALANCE = 30;

    private final HttpClient client = HttpClient.newHttpClient();
    private SnapshotCustomerDao customers;
    private PausingOrderDao orders;
    private InMemoryMenuDao menu;
    private OrderEventSubject subject;
    private MenuItem drink;
    private ExecutorService executor;
    private HttpServer server;

    @BeforeEach
    void setUp() throws IOException {
        InMemoryDatabase.getInstance().reset();
        SystemConfigManager.getInstance().resetToDefaults();
        menu = new InMemoryMenuDao();
        drink = new MenuItem(DRINK_ID, "Ca phe muoi", "Coffee", 45_000, 15_000);
        drink.setInStock(true);
        menu.save(drink);
        customers = new SnapshotCustomerDao();
        Customer member = new Customer(null, "Vo Lan", PHONE, null);
        member.setLoyaltyPoints(BALANCE);
        customers.save(member);

        server = HttpServer.create(new InetSocketAddress(0), 0);
        orders = new PausingOrderDao();
        subject = new OrderEventSubject();
        server.createContext("/api/checkout", new CheckoutHandler(
                new PosCheckoutFacade(orders, menu, subject), customers, new InMemoryTableDao(), () -> true));
        executor = Executors.newFixedThreadPool(4);
        server.setExecutor(executor);
        server.start();
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
        executor.shutdownNow();
        InMemoryDatabase.getInstance().reset();
    }

    @Test
    void twoCheckoutsCannotBothSpendTheSamePointsBalance() throws Exception {
        // The first checkout has read the balance but not redeemed it when the second arrives.
        customers.pauseNextLookup();
        CompletableFuture<HttpResponse<String>> first = redeemAll();
        assertTrue(customers.lookupPaused.await(5, TimeUnit.SECONDS));
        HttpResponse<String> second = redeemAll().get(10, TimeUnit.SECONDS);

        HttpResponse<String> firstResponse = first.get(10, TimeUnit.SECONDS);
        assertEquals(200, firstResponse.statusCode(), firstResponse.body());
        assertEquals(BALANCE, ((Number) data(firstResponse).get("pointsRedeemed")).intValue());
        assertEquals(400, second.statusCode(), second.body());
        assertTrue(second.body().contains("INSUFFICIENT_POINTS"), second.body());
    }

    @Test
    void anotherOrderPaidDuringCheckoutDoesNotCreditTheMember() throws Exception {
        // /pay and /sync broadcast on the same subject under a different lock than checkout.
        Order unrelated = new OrderBuilder().forCustomer("Walk-in").addItem(new BaseCoffee(drink), 20)
                .withPayment(PaymentMethod.CASH, true).build();
        orders.pauseNextSave();
        CompletableFuture<HttpResponse<String>> checkout = post("{\"paymentMethod\":\"cash\",\"orderType\":\"pickup\","
                + "\"lines\":[{\"menuItemId\":" + DRINK_ID + ",\"qty\":1}],\"customerPhone\":\"" + PHONE + "\"}");
        assertTrue(orders.savePaused.await(5, TimeUnit.SECONDS));
        subject.notifyOrderPaid(unrelated);
        orders.releaseSave.countDown();

        HttpResponse<String> response = checkout.get(10, TimeUnit.SECONDS);
        assertEquals(200, response.statusCode(), response.body());
        double ownTotal = ((Number) data(response).get("finalTotal")).doubleValue();
        Customer member = customers.findById(customers.findByPhone(PHONE).orElseThrow().getId()).orElseThrow();
        assertEquals(1, member.getTotalOrders());
        assertEquals(ownTotal, member.getTotalSpent());
        assertEquals(BALANCE + SystemConfigManager.getInstance().calculateLoyaltyPoints(ownTotal), member.getLoyaltyPoints());
    }

    @Test
    void aPaidStorefrontOrderEnrolsANewPhoneAsAMemberAndEarnsPoints() throws Exception {
        String phone = "0977000444";
        HttpResponse<String> response = post("{\"paymentMethod\":\"qr\",\"orderType\":\"pickup\",\"customer\":\"Le Mai\","
                + "\"customerEmail\":\"mai@example.com\",\"enrollMember\":true,"
                + "\"lines\":[{\"menuItemId\":" + DRINK_ID + ",\"qty\":2}],\"customerPhone\":\"" + phone + "\"}")
                .get(10, TimeUnit.SECONDS);

        assertEquals(200, response.statusCode(), response.body());
        double total = ((Number) data(response).get("finalTotal")).doubleValue();
        int earned = SystemConfigManager.getInstance().calculateLoyaltyPoints(total);
        assertTrue(earned > 0);
        assertEquals(earned, ((Number) data(response).get("pointsEarned")).intValue());
        Customer member = customers.findById(customers.findByPhone(phone).orElseThrow().getId()).orElseThrow();
        assertEquals("Le Mai", member.getName());
        assertEquals("mai@example.com", member.getEmail());
        assertEquals(1, member.getTotalOrders());
        assertEquals(earned, member.getLoyaltyPoints());
    }

    @Test
    void anUnknownPhoneIsNotEnrolledUnlessAsked() throws Exception {
        String phone = "0977000555";
        HttpResponse<String> response = post("{\"paymentMethod\":\"cash\",\"orderType\":\"pickup\",\"customer\":\"Walk-in\","
                + "\"lines\":[{\"menuItemId\":" + DRINK_ID + ",\"qty\":1}],\"customerPhone\":\"" + phone + "\"}")
                .get(10, TimeUnit.SECONDS);

        assertEquals(200, response.statusCode(), response.body());
        assertTrue(customers.findByPhone(phone).isEmpty());
        assertEquals(0, ((Number) data(response).get("pointsEarned")).intValue());
    }

    @Test
    void pointsThatCannotBeDeductedAreNeitherDiscountedNorCharged() throws Exception {
        customers.failRedeem.set(true);
        int ordersBefore = orders.findAll().size();

        HttpResponse<String> response = redeemAll().get(10, TimeUnit.SECONDS);

        assertEquals(503, response.statusCode(), response.body());
        assertTrue(response.body().contains("DATABASE_UNAVAILABLE"), response.body());
        assertEquals(ordersBefore, orders.findAll().size(), "no order may be saved");
        assertEquals(BALANCE, customers.findByPhone(PHONE).orElseThrow().getLoyaltyPoints());
    }

    @Test
    void failedCheckoutGivesTheHeldPointsBack() throws Exception {
        // The drink is off sale: the facade refuses after the points were checked.
        menu.toggleInStock(DRINK_ID, false);
        HttpResponse<String> response = redeemAll().get(10, TimeUnit.SECONDS);

        assertEquals(409, response.statusCode(), response.body());
        assertEquals(BALANCE, customers.findByPhone(PHONE).orElseThrow().getLoyaltyPoints());
    }

    private CompletableFuture<HttpResponse<String>> redeemAll() {
        return post("{\"paymentMethod\":\"cash\",\"orderType\":\"pickup\",\"lines\":[{\"menuItemId\":" + DRINK_ID
                + ",\"qty\":1}],\"customerPhone\":\"" + PHONE + "\",\"useLoyaltyPoints\":" + BALANCE + "}");
    }

    private CompletableFuture<HttpResponse<String>> post(String body) {
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + server.getAddress().getPort()
                        + "/api/checkout"))
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .header("Content-Type", "application/json")
                .build();
        return client.sendAsync(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> data(HttpResponse<String> response) {
        return (Map<String, Object>) ((Map<String, Object>) Json.parse(response.body())).get("data");
    }

    /** Can hold the next save until the test releases it (or 5 s pass). */
    private static final class PausingOrderDao extends InMemoryOrderDao {
        final CountDownLatch savePaused = new CountDownLatch(1);
        final CountDownLatch releaseSave = new CountDownLatch(1);
        private final AtomicBoolean pauseNext = new AtomicBoolean();

        void pauseNextSave() {
            pauseNext.set(true);
        }

        @Override
        public boolean save(Order order) {
            if (pauseNext.compareAndSet(true, false)) {
                savePaused.countDown();
                try {
                    releaseSave.await(5, TimeUnit.SECONDS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
            return super.save(order);
        }
    }

    /** Reads return copies; one lookup can be held until points are redeemed (or 500 ms pass); redeeming can be made to fail. */
    private static final class SnapshotCustomerDao extends InMemoryCustomerDao {
        final CountDownLatch lookupPaused = new CountDownLatch(1);
        private final CountDownLatch redeemed = new CountDownLatch(1);
        private final AtomicBoolean pauseNext = new AtomicBoolean();
        final AtomicBoolean failRedeem = new AtomicBoolean();

        void pauseNextLookup() {
            pauseNext.set(true);
        }

        @Override
        public Optional<Customer> findByPhone(String phone) {
            Optional<Customer> found = super.findByPhone(phone).map(SnapshotCustomerDao::copy);
            if (pauseNext.compareAndSet(true, false)) {
                lookupPaused.countDown();
                try {
                    redeemed.await(500, TimeUnit.MILLISECONDS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
            return found;
        }

        @Override
        public boolean redeemPoints(int id, int points) {
            // A failed write, as the JDBC DAO reports one.
            boolean ok = !failRedeem.get() && super.redeemPoints(id, points);
            redeemed.countDown();
            return ok;
        }

        private static Customer copy(Customer source) {
            Customer copy = new Customer(source.getId(), source.getName(), source.getPhone(), source.getEmail());
            copy.setLoyaltyPoints(source.getLoyaltyPoints());
            return copy;
        }
    }
}
