package com.dalatcafe.dao;

import com.dalatcafe.model.UserAccount;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * In-memory accounts. Returns and stores copies, and checks uniqueness inside one lock, so two
 * concurrent sign-ups cannot claim the same email.
 */
public class InMemoryUserDao implements IUserDao {
    private final InMemoryDatabase db;

    public InMemoryUserDao() {
        this(InMemoryDatabase.getInstance());
    }

    public InMemoryUserDao(InMemoryDatabase db) {
        this.db = Objects.requireNonNull(db, "Database must not be null");
    }

    private Map<Integer, UserAccount> users() {
        return db.getUsers();
    }

    @Override
    public List<UserAccount> findAll() {
        return users().values().stream()
                .sorted(Comparator.comparing(UserAccount::getId))
                .map(UserAccount::copy)
                .toList();
    }

    @Override
    public Optional<UserAccount> findById(int id) {
        return Optional.ofNullable(users().get(id)).map(UserAccount::copy);
    }

    @Override
    public Optional<UserAccount> findByEmail(String email) {
        String wanted = UserAccount.normalizeEmail(email);
        if (wanted == null) return Optional.empty();
        return users().values().stream().filter(u -> wanted.equals(u.getEmail())).findFirst().map(UserAccount::copy);
    }

    @Override
    public Optional<UserAccount> findByGoogleSubject(String googleSubject) {
        if (googleSubject == null) return Optional.empty();
        return users().values().stream()
                .filter(u -> googleSubject.equals(u.getGoogleSubject()))
                .findFirst()
                .map(UserAccount::copy);
    }

    @Override
    public boolean save(UserAccount user) {
        if (user == null || user.getEmail() == null) return false;
        synchronized (db) {
            for (UserAccount other : users().values()) {
                boolean sameRow = user.getId() != null && user.getId().equals(other.getId());
                if (sameRow) continue;
                if (other.getEmail().equals(user.getEmail())) return false;
                if (user.getGoogleSubject() != null && user.getGoogleSubject().equals(other.getGoogleSubject())) return false;
            }
            if (user.getId() == null) {
                user.setId(db.generateUserId());
            }
            users().put(user.getId(), user.copy());
            return true;
        }
    }
}
