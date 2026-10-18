package com.dalatcafe.model;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;

/**
 * Table entity representing a physical seating table on the floor plan.
 */
public class Table implements Serializable {
    private static final long serialVersionUID = 1L;

    private int id;
    private String name;
    private int seats;
    private String zone;
    private String imageUrl;
    private boolean archived;

    public boolean isArchived() { return archived; }
    public void setArchived(boolean archived) { this.archived = archived; }

    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }
    private TableStatus status;
    private int guestCount;
    private Instant occupiedSince;
    private Instant updatedAt;

    public Table() {
        this.seats = 2;
        this.zone = "Main";
        this.status = TableStatus.AVAILABLE;
        this.guestCount = 0;
        this.updatedAt = Instant.now();
    }

    public Table(int id, String name, int seats, String zone) {
        this();
        this.id = id;
        this.name = name;
        this.seats = seats;
        this.zone = zone != null ? zone : "Main";
    }

    public Table(int id, String name, int seats, String zone, TableStatus status, int guestCount) {
        this(id, name, seats, zone);
        this.status = status != null ? status : TableStatus.AVAILABLE;
        this.guestCount = guestCount;
        this.occupiedSince = this.status == TableStatus.OCCUPIED ? Instant.now() : null;
        this.updatedAt = Instant.now();
    }

    public int getId() {
        return id;
    }

    public void setId(int id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getSeats() {
        return seats;
    }

    public void setSeats(int seats) {
        this.seats = seats;
    }

    public String getZone() {
        return zone;
    }

    public void setZone(String zone) {
        this.zone = zone;
    }

    public TableStatus getStatus() {
        return status;
    }

    public void setStatus(TableStatus status) {
        this.status = status;
        this.updatedAt = Instant.now();
        if (status == TableStatus.OCCUPIED && this.occupiedSince == null) {
            this.occupiedSince = Instant.now();
        } else if (status != TableStatus.OCCUPIED) {
            this.occupiedSince = null;
            this.guestCount = 0;
        }
    }

    public int getGuestCount() {
        return guestCount;
    }

    public void setGuestCount(int guestCount) {
        this.guestCount = guestCount;
    }

    public Instant getOccupiedSince() {
        return occupiedSince;
    }

    public void setOccupiedSince(Instant occupiedSince) {
        this.occupiedSince = occupiedSince;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Table table = (Table) o;
        return id == table.id;
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "Table{" +
                "id=" + id +
                ", name='" + name + '\'' +
                ", seats=" + seats +
                ", zone='" + zone + '\'' +
                ", status=" + status +
                ", guestCount=" + guestCount +
                '}';
    }
}

