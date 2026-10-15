package com.dalatcafe.dao;

import com.dalatcafe.model.Customer;
import com.dalatcafe.model.CustomerRank;

import java.util.List;
import java.util.Optional;

/**
 * Data Access Object interface for Customer CRM entity.
 */
public interface ICustomerDao {
    List<Customer> findAll();
    Optional<Customer> findById(int id);
    Optional<Customer> findByPhone(String phone);
    List<Customer> findByRank(CustomerRank rank);
    boolean save(Customer customer);
    boolean addOrderRecord(int id, double orderAmount, int earnedPoints);
    boolean redeemPoints(int id, int points);
    boolean deleteById(int id);
}

