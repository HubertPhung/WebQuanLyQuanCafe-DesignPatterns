package com.dalatcafe.patterns;

import com.dalatcafe.dao.*;
import com.dalatcafe.model.*;
import com.dalatcafe.patterns.chain.*;
import com.dalatcafe.patterns.singleton.SystemConfigManager;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import static org.junit.jupiter.api.Assertions.*;

class ChainTest {
    private static final ZoneId CAFE_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    // Midnight at the café on the day every fixture booking falls on, so all of them lie ahead.
    private static final Clock CLOCK = clockAt("00:00");
    private final SystemConfigManager config = SystemConfigManager.getInstance();
    private CountingTables tables;
    private CountingReservations reservations;
    private ReservationValidatorHandler chain;

    @BeforeEach
    void setUp() {
        config.resetToDefaults();
        tables = new CountingTables();
        reservations = new CountingReservations();
        chain = chainAt(CLOCK);
    }

    private ReservationValidatorHandler chainAt(Clock clock) {
        return ReservationValidationChainFactory.create(
                tables, reservations, TableAvailabilityValidator.DEFAULT_DURATION, clock);
    }

    @AfterEach
    void restoreConfig() {
        config.resetToDefaults();
    }

    @ParameterizedTest
    @CsvSource({"06:59:59,false", "07:00,true", "22:00,true", "22:00:01,false", "12:00,true"})
    void checksLocalOperatingHourBoundaries(String time, boolean valid) {
        assertEquals(valid, chain.validate(booking(time)).isValid());
    }

    @Test
    void convertsUtcToVietnamTimeAndReadsLiveConfig() {
        Reservation booking = booking("08:00");
        assertEquals(Instant.parse("2026-10-16T01:00:00Z"), booking.getDateTime());
        assertTrue(chain.validate(booking).isValid());
        config.setOpeningTime(LocalTime.of(9, 0));
        assertFalse(chain.validate(booking).isValid());
        config.setClosingTime(LocalTime.of(10, 0));
        assertFalse(chain.validate(booking("11:00")).isValid());
    }

    @Test
    void rejectsMissingInputsWithoutCallingLaterDao() {
        assertFalse(chain.validate(null).isValid());
        Reservation booking = booking("12:00");
        booking.setDateTime(null);
        assertFalse(chain.validate(booking).isValid());
        assertEquals(0, tables.reads);
        assertEquals(0, reservations.reads);
        booking = booking("12:00");
        booking.setTableId(null);
        assertFalse(chain.validate(booking).isValid());
        assertEquals(0, reservations.reads);
    }

    @Test
    void capacityUsesBothConfigAndActualSeats() {
        Reservation booking = booking("12:00");
        booking.setGuests(5);
        assertFalse(chain.validate(booking).isValid());
        tables.table.setSeats(30);
        booking.setGuests(21);
        assertFalse(chain.validate(booking).isValid());
        booking.setGuests(20);
        assertTrue(chain.validate(booking).isValid());
        config.setMaxReservationGuests(3);
        booking.setGuests(4);
        assertFalse(chain.validate(booking).isValid());
        booking.setGuests(3);
        assertTrue(chain.validate(booking).isValid());
        booking.setTableId(999);
        assertFalse(chain.validate(booking).isValid());
    }

    @Test
    void rejectsRawInvalidGuestCountButPreservesSetterCompatibility() {
        Reservation booking = new Reservation(null, null, "Guest", "0901234567",
                booking("12:00").getDateTime(), 0);
        booking.setTableId(1);
        assertFalse(chain.validate(booking).isValid());
        booking.setGuests(0);
        assertEquals(1, booking.getGuests());
        assertTrue(chain.validate(booking).isValid());
    }

    @ParameterizedTest
    @CsvSource({"09:59,true", "10:00,true", "10:01,false", "11:00,false",
            "12:00,false", "13:59,false", "14:00,true", "14:01,true"})
    void rejectsIntersectingHalfOpenSlots(String requestedTime, boolean valid) {
        reservations.entries.add(booking("12:00"));
        assertEquals(valid, chain.validate(booking(requestedTime)).isValid());
    }

    @ParameterizedTest
    @EnumSource(ReservationStatus.class)
    void onlyCancelledBookingsReleaseTheirSlot(ReservationStatus status) {
        Reservation existing = booking("12:00");
        existing.setStatus(status);
        reservations.entries.add(existing);
        assertEquals(status == ReservationStatus.CANCELLED, chain.validate(booking("12:00")).isValid());
    }

    @Test
    void differentTablesAndDatesDoNotConflict() {
        Reservation existing = booking("12:00");
        existing.setTableId(2);
        reservations.entries.add(existing);
        assertTrue(chain.validate(booking("12:00")).isValid());
        existing.setTableId(1);
        existing.setDateTime(existing.getDateTime().minus(Duration.ofDays(1)));
        assertTrue(chain.validate(booking("12:00")).isValid());
    }

    @Test
    void editSkipsOnlyMatchingNonNullId() {
        Reservation existing = booking("12:00");
        reservations.entries.add(existing);
        Reservation requested = booking("12:00");
        // Both IDs and codes are null; entity equality must not skip this conflict.
        assertFalse(chain.validate(requested).isValid());
        existing.setId(10);
        requested.setId(10);
        assertTrue(chain.validate(requested).isValid());
        requested.setId(11);
        assertFalse(chain.validate(requested).isValid());
    }

    @Test
    void supportsCustomDurationAndIgnoresCurrentTableStatus() {
        reservations.entries.add(booking("12:00"));
        chain = ReservationValidationChainFactory.create(tables, reservations, Duration.ofHours(1), CLOCK);
        assertTrue(chain.validate(booking("13:00")).isValid());
        tables.table.setStatus(TableStatus.OCCUPIED);
        assertTrue(chain.validate(booking("15:00")).isValid());
    }

    @Test
    void failsFastBeforeDownstreamDaoAndPropagatesDaoFailures() {
        assertFalse(chain.validate(booking("06:00")).isValid());
        assertEquals(0, tables.reads);
        assertEquals(0, reservations.reads);
        Reservation tooMany = booking("12:00");
        tooMany.setGuests(5);
        assertFalse(chain.validate(tooMany).isValid());
        assertEquals(0, reservations.reads);
        reservations.failure = new IllegalStateException("DAO unavailable");
        assertSame(reservations.failure,
                assertThrows(IllegalStateException.class, () -> chain.validate(booking("12:00"))));
        tables.failure = new IllegalStateException("Table DAO unavailable");
        assertSame(tables.failure,
                assertThrows(IllegalStateException.class, () -> chain.validate(booking("12:00"))));
    }

    @Test
    void successfulChainIsReadOnlyAndReturnsValidResult() {
        Reservation requested = booking("12:00");
        ValidationResult result = chain.validate(requested);
        assertTrue(result.isValid());
        assertNull(result.getErrorMessage());
        assertNull(requested.getId());
        assertEquals(ReservationStatus.PENDING, requested.getStatus());
        assertTrue(reservations.entries.isEmpty());
        assertEquals(TableStatus.AVAILABLE, tables.table.getStatus());
    }

    @Test
    void rejectsMalformedStoredBookingsAndInvalidDurations() {
        Reservation existing = booking("12:00");
        existing.setDateTime(null);
        reservations.entries.add(existing);
        assertFalse(chain.validate(booking("12:00")).isValid());
        existing.setDateTime(booking("12:00").getDateTime());
        existing.setStatus(null);
        assertFalse(chain.validate(booking("12:00")).isValid());
        assertThrows(IllegalArgumentException.class,
                () -> new TableAvailabilityValidator(reservations, Duration.ZERO));
        assertThrows(IllegalArgumentException.class,
                () -> new TableAvailabilityValidator(reservations, Duration.ofSeconds(-1)));
        assertThrows(NullPointerException.class,
                () -> new TableAvailabilityValidator(reservations, null));
        assertThrows(NullPointerException.class, () -> new CapacityGuestValidator(null));
        assertThrows(NullPointerException.class, () -> new TableAvailabilityValidator(null));
    }

    @Test
    void rejectsUnrepresentableTimesAndOverflowingSlots() {
        Reservation requested = booking("12:00");
        requested.setDateTime(Instant.MAX);
        assertFalse(chain.validate(requested).isValid());
        TableAvailabilityValidator availability = new TableAvailabilityValidator(reservations);
        assertFalse(availability.validate(requested).isValid());
        assertFalse(availability.validate(null).isValid());
        Reservation existing = booking("12:00");
        existing.setDateTime(Instant.MAX);
        reservations.entries.add(existing);
        assertFalse(availability.validate(booking("12:00")).isValid());
    }

    @Test
    void handlerStopsAtFirstFailureAndRejectsCycles() {
        int[] calls = {0};
        ReservationValidatorHandler tail = new ReservationValidatorHandler() {
            public ValidationResult validate(Reservation reservation) {
                calls[0]++;
                return checkNext(reservation);
            }
        };
        OperatingHoursValidator head = new OperatingHoursValidator(CLOCK);
        head.setNext(tail);
        ValidationResult invalid = head.validate(booking("06:00"));
        assertFalse(invalid.isValid());
        assertFalse(invalid.getErrorMessage().isBlank());
        assertEquals(0, calls[0]);
        assertTrue(head.validate(booking("12:00")).isValid());
        assertEquals(1, calls[0]);
        assertThrows(IllegalArgumentException.class, () -> tail.setNext(head));
        assertThrows(IllegalArgumentException.class, () -> head.setNext(head));
        head.setNext(null);
        assertTrue(head.validate(booking("12:00")).isValid());
    }

    @Test
    void rejectsBookingsThatAlreadyStartedBeyondTheGraceWindow() {
        chain = chainAt(clockAt("12:00"));
        ValidationResult late = chain.validate(booking("11:44:59"));
        assertFalse(late.isValid());
        assertTrue(late.getErrorMessage().contains("đã qua"));
        assertEquals(0, tables.reads);
        assertEquals(0, reservations.reads);
        assertTrue(chain.validate(booking("11:45")).isValid());
        assertTrue(chain.validate(booking("12:00")).isValid());
    }

    @Test
    void defaultClockIsTheSystemClock() {
        Reservation longAgo = booking("12:00");
        longAgo.setDateTime(Instant.parse("2020-01-01T05:00:00Z"));
        assertFalse(new OperatingHoursValidator().validate(longAgo).isValid());
        assertFalse(ReservationValidationChainFactory.create(tables, reservations).validate(longAgo).isValid());
        Reservation ahead = booking("12:00");
        ahead.setDateTime(Instant.now().plus(Duration.ofDays(1)).atZone(CAFE_ZONE)
                .with(LocalTime.NOON).toInstant());
        assertTrue(new OperatingHoursValidator().validate(ahead).isValid());
        assertThrows(NullPointerException.class, () -> new OperatingHoursValidator(null));
    }

    @Test
    void openingHoursAreReadAsOnePairWhileSettingsChange() throws InterruptedException {
        // 12:30 is outside both 07:00-12:00 and 13:00-22:00, so every answer must be a refusal
        // that quotes one of those two pairs, never a mix of an old and a new value.
        Set<String> consistent = Set.of(
                "Quán chỉ nhận đặt bàn trong giờ mở cửa (07:00 - 12:00).",
                "Quán chỉ nhận đặt bàn trong giờ mở cửa (13:00 - 22:00).");
        config.setOpeningTime(LocalTime.of(7, 0));
        config.setClosingTime(LocalTime.of(12, 0));
        AtomicBoolean stop = new AtomicBoolean();
        Thread admin = new Thread(() -> {
            for (int i = 0; !stop.get(); i++) {
                LocalTime opening = i % 2 == 0 ? LocalTime.of(13, 0) : LocalTime.of(7, 0);
                LocalTime closing = i % 2 == 0 ? LocalTime.of(22, 0) : LocalTime.of(12, 0);
                synchronized (config) { // the critical section ConfigHandler.update runs
                    config.setOpeningTime(opening);
                    config.setClosingTime(closing);
                }
            }
        });
        admin.start();
        try {
            long deadline = System.nanoTime() + Duration.ofSeconds(2).toNanos();
            while (System.nanoTime() < deadline) {
                ValidationResult result = chain.validate(booking("12:30"));
                assertFalse(result.isValid(), "12:30 is closed under both settings");
                assertTrue(consistent.contains(result.getErrorMessage()), result.getErrorMessage());
            }
        } finally {
            stop.set(true);
            admin.join();
        }
    }

    private static Clock clockAt(String time) {
        return Clock.fixed(at(time), ZoneOffset.UTC);
    }

    private static Instant at(String time) {
        return LocalDate.of(2026, 10, 16).atTime(LocalTime.parse(time)).atZone(CAFE_ZONE).toInstant();
    }

    private static Reservation booking(String time) {
        Reservation reservation = new Reservation();
        reservation.setDateTime(at(time));
        reservation.setTableId(1);
        reservation.setGuests(2);
        return reservation;
    }

    private static final class CountingTables extends InMemoryTableDao {
        final Table table = new Table(1, "Bàn 1", 4, "Main");
        int reads;
        RuntimeException failure;
        @Override
        public Optional<Table> findById(int id) {
            reads++;
            if (failure != null) throw failure;
            return id == table.getId() ? Optional.of(table) : Optional.empty();
        }
    }

    private static final class CountingReservations extends InMemoryReservationDao {
        final List<Reservation> entries = new ArrayList<>();
        int reads;
        RuntimeException failure;
        @Override
        public List<Reservation> findAll() {
            reads++;
            if (failure != null) throw failure;
            return List.copyOf(entries);
        }
    }
}
