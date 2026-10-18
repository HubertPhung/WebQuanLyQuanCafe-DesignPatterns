package com.dalatcafe.dao;

import com.dalatcafe.model.Customer;
import com.dalatcafe.model.CustomerRank;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * In-memory implementation of ICustomerDao using thread-safe collection.
 */
public class InMemoryCustomerDao implements ICustomerDao {
    private final InMemoryDatabase db;

    public InMemoryCustomerDao() {
        this(InMemoryDatabase.getInstance());
    }

    public InMemoryCustomerDao(InMemoryDatabase db) {
        this.db = db;
    }

    @Override
    public List<Customer> findAll() {
        return db.getCustomers().values().stream()
                .sorted(Comparator.comparingDouble(Customer::getTotalSpent).reversed())
                .collect(Collectors.toList());
    }

    @Override
    public Optional<Customer> findById(int id) {
        return Optional.ofNullable(db.getCustomers().get(id));
    }

    @Override
    public Optional<Customer> findByPhone(String phone) {
        if (phone == null) return Optional.empty();
        return db.getCustomers().values().stream()
                .filter(c -> phone.equals(c.getPhone()))
                .findFirst();
    }

    @Override
    public List<Customer> findByRank(CustomerRank rank) {
        if (rank == null) return new ArrayList<>();
        return db.getCustomers().values().stream()
                .filter(c -> c.getRank() == rank)
                .sorted(Comparator.comparingDouble(Customer::getTotalSpent).reversed())
                .collect(Collectors.toList());
    }

    @Override
    public boolean save(Customer customer) {
        if (customer == null) return false;
        if (customer.getId() == null) {
            customer.setId(db.generateCustomerId());
        }
        db.getCustomers().put(customer.getId(), customer);
        return true;
    }

    @Override
    public boolean addOrderRecord(int id, double orderAmount, int earnedPoints) {
        Customer customer = db.getCustomers().get(id);
        if (customer == null) return false;
        // The live row is shared by every request, so a change must not interleave with another.
        synchronized (customer) {
            customer.addOrderRecord(orderAmount, earnedPoints);
        }
        return true;
    }

    @Override
    public boolean redeemPoints(int id, int points) {
        Customer customer = db.getCustomers().get(id);
        if (customer == null) return false;
        synchronized (customer) {
            return customer.redeemPoints(points);
        }
    }

    @Override
    public boolean restorePoints(int id, int points) {
        Customer customer = db.getCustomers().get(id);
        if (customer == null) return false;
        synchronized (customer) {
            return customer.restorePoints(points);
        }
    }

    @Override
    public boolean deleteById(int id) {
        return db.getCustomers().remove(id) != null;
    }
}

