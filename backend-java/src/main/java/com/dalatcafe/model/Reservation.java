package com.dalatcafe.model;

import java.io.Serializable;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * Thực thể Reservation: một phiếu đặt bàn của khách.
 */
public class Reservation implements Serializable {
    private static final long serialVersionUID = 1L;

    /** Thời gian giữ bàn của phiếu không ghi giờ kết thúc (phiếu cũ, hoặc client không gửi). */
    public static final java.time.Duration DEFAULT_LENGTH = java.time.Duration.ofHours(2);

    /**
     * Thời gian chờ khách đến chỉ hủy các phiếu chưa nhận bàn, không bao giờ cắt ngang lượt của
     * khách đã ngồi.
     */
    public boolean isNoShowAt(Instant now, int graceMinutes) {
        return dateTime != null && (status == ReservationStatus.PENDING || status == ReservationStatus.CONFIRMED)
                && !now.isBefore(dateTime.plusSeconds(graceMinutes * 60L));
    }

    private Integer id;
    private String reservationCode;
    private String customer;
    private String contact;
    private String email;
    private Integer userId;

    public Integer getUserId() {
        return userId;
    }

    public void setUserId(Integer userId) {
        this.userId = userId;
    }

    /**
     * Phiếu đặt bàn cũ của khách không có id tài khoản; email liên hệ của phiếu dùng để nhận ra tài
     * khoản.
     */
    public boolean belongsToAccount(int accountId, String accountEmail) {
        if (userId != null) return userId == accountId;
        return accountEmail != null && !accountEmail.isBlank() && email != null
                && email.trim().equalsIgnoreCase(accountEmail.trim());
    }
    private Instant dateTime;
    private Instant endTime;
    private String tableName;
    private Integer tableId;
    private List<Integer> tableIds = List.of();
    private String branch = Branches.DEFAULT;

    public String getBranch() {
        return branch;
    }

    public void setBranch(String branch) {
        this.branch = Branches.orDefault(branch);
    }

    public List<Integer> getTableIds() {
        return tableIds.isEmpty() ? (tableId == null ? List.of() : List.of(tableId)) : List.copyOf(tableIds);
    }

    public void setTableIds(List<Integer> ids) {
        tableIds = ids == null ? List.of() : ids.stream().distinct().toList();
        if (!tableIds.isEmpty()) tableId = tableIds.get(0);
    }
    private int guests;
    private ReservationStatus status;
    private String note;
    private List<OrderItem> preOrders;
    private Instant createdAt;

    public Reservation() {
        this.guests = 2;
        this.status = ReservationStatus.PENDING;
        this.preOrders = new ArrayList<>();
        this.createdAt = Instant.now();
    }

    public Reservation(Integer id, String reservationCode, String customer, String contact, Instant dateTime, int guests) {
        this();
        this.id = id;
        this.reservationCode = reservationCode;
        this.customer = customer;
        this.contact = contact;
        this.dateTime = dateTime;
        this.guests = guests;
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getReservationCode() {
        return reservationCode;
    }

    public void setReservationCode(String reservationCode) {
        this.reservationCode = reservationCode;
    }

    public String getCustomer() {
        return customer;
    }

    public void setCustomer(String customer) {
        this.customer = customer;
    }

    public String getContact() {
        return contact;
    }

    public void setContact(String contact) {
        this.contact = contact;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public Instant getDateTime() {
        return dateTime;
    }

    public void setDateTime(Instant dateTime) {
        this.dateTime = dateTime;
    }

    /** Giờ kết thúc khách chọn; phiếu cũ không có thì coi như giữ bàn {@link #DEFAULT_LENGTH}. */
    public Instant getEndTime() {
        if (endTime != null) return endTime;
        return dateTime == null ? null : dateTime.plus(DEFAULT_LENGTH);
    }

    /** Giá trị đã lưu, null với phiếu tạo trước khi có giờ kết thúc. */
    public Instant getStoredEndTime() {
        return endTime;
    }

    public void setEndTime(Instant endTime) {
        this.endTime = endTime;
    }

    /** Khoảng giữ bàn nửa mở [bắt đầu, kết thúc): phiếu sau được bắt đầu đúng lúc phiếu trước kết thúc. */
    public boolean overlaps(Instant start, Instant end) {
        Instant ownEnd = getEndTime();
        return dateTime != null && ownEnd != null && dateTime.isBefore(end) && start.isBefore(ownEnd);
    }

    public String getTableName() {
        return tableName;
    }

    public void setTableName(String tableName) {
        this.tableName = tableName;
    }

    public Integer getTableId() {
        return tableId;
    }

    public void setTableId(Integer tableId) {
        this.tableId = tableId;
    }

    public int getGuests() {
        return guests;
    }

    public void setGuests(int guests) {
        this.guests = Math.max(1, guests);
    }

    public ReservationStatus getStatus() {
        return status;
    }

    public void setStatus(ReservationStatus status) {
        this.status = status;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public List<OrderItem> getPreOrders() {
        return Collections.unmodifiableList(preOrders);
    }

    public void setPreOrders(List<OrderItem> preOrders) {
        this.preOrders = preOrders != null ? new ArrayList<>(preOrders) : new ArrayList<>();
    }

    public void addPreOrder(OrderItem item) {
        if (item != null) {
            this.preOrders.add(item);
        }
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    /**
     * So sánh chỉ theo reservationCode (duy nhất trong `reservations.reservation_code`) để equals
     * và hashCode khớp nhau; nếu không có mã thì chỉ bằng chính nó.
     */
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Reservation that = (Reservation) o;
        return reservationCode != null && reservationCode.equals(that.reservationCode);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(reservationCode);
    }

    @Override
    public String toString() {
        return "Reservation{" +
                "id=" + id +
                ", code='" + reservationCode + '\'' +
                ", customer='" + customer + '\'' +
                ", tableId=" + tableId +
                ", guests=" + guests +
                ", status=" + status +
                '}';
    }
}

