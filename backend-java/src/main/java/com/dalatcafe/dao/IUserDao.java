package com.dalatcafe.dao;

import com.dalatcafe.model.UserAccount;

import java.util.List;
import java.util.Optional;

/** Sign-in accounts. Emails are unique (case-insensitive), as are Google subject ids. */
public interface IUserDao {
    List<UserAccount> findAll();

    Optional<UserAccount> findById(int id);

    Optional<UserAccount> findByEmail(String email);

    Optional<UserAccount> findByGoogleSubject(String googleSubject);

    /** Inserts (id null, assigns one) or updates. False when the email or Google id is taken. */
    boolean save(UserAccount user);
}
