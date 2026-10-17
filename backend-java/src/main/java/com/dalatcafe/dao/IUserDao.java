package com.dalatcafe.dao;

import com.dalatcafe.model.UserAccount;

import java.util.List;
import java.util.Optional;

/** Sign-in accounts. Emails are unique (case-insensitive). */
public interface IUserDao {
    List<UserAccount> findAll();

    Optional<UserAccount> findById(int id);

    Optional<UserAccount> findByEmail(String email);

    /** Inserts (id null, assigns one) or updates. False when the email is taken. */
    boolean save(UserAccount user);
}
