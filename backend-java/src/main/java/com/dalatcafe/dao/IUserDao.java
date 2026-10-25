package com.dalatcafe.dao;

import com.dalatcafe.model.UserAccount;

import java.util.List;
import java.util.Optional;

/**
 * Tài khoản đăng nhập. Email là duy nhất (không phân biệt hoa thường), Google subject id cũng vậy.
 */
public interface IUserDao {
    List<UserAccount> findAll();

    Optional<UserAccount> findById(int id);

    Optional<UserAccount> findByEmail(String email);

    Optional<UserAccount> findByGoogleSubject(String googleSubject);

    /**
     * Thêm mới (id null thì tự cấp) hoặc cập nhật. Trả về false khi email hoặc Google id đã được
     * dùng.
     */
    boolean save(UserAccount user);
}
