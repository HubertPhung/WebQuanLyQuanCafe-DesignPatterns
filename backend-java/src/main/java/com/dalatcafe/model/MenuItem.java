package com.dalatcafe.model;

import java.io.Serializable;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * Thực thể MenuItem: một đồ uống, món ăn hoặc nguyên liệu.
 */
public class MenuItem implements Serializable {
    private static final long serialVersionUID = 1L;

    private Integer id;
    private String name;
    private String category;
    private String kind; // "menu" hoặc "ingredient"
    private String unit;
    private double costPrice;
    private double sellPrice;
    private boolean inStock;
    private String recipe;
    private List<Variation> variations;
    private String imageUrl;
    private Instant createdAt;

    public MenuItem() {
        this.kind = "menu";
        this.unit = "ly";
        this.inStock = true;
        this.variations = new ArrayList<>();
        this.createdAt = Instant.now();
    }

    public MenuItem(Integer id, String name, String category, double sellPrice, double costPrice) {
        this();
        this.id = id;
        this.name = name;
        this.category = category;
        this.sellPrice = sellPrice;
        this.costPrice = costPrice;
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getKind() {
        return kind;
    }

    public void setKind(String kind) {
        this.kind = kind;
    }

    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        this.unit = unit;
    }

    public double getCostPrice() {
        return costPrice;
    }

    public void setCostPrice(double costPrice) {
        this.costPrice = costPrice;
    }

    public double getSellPrice() {
        return sellPrice;
    }

    public void setSellPrice(double sellPrice) {
        this.sellPrice = sellPrice;
    }

    public boolean isInStock() {
        return inStock;
    }

    public void setInStock(boolean inStock) {
        this.inStock = inStock;
    }

    public String getRecipe() {
        return recipe;
    }

    public void setRecipe(String recipe) {
        this.recipe = recipe;
    }

    public List<Variation> getVariations() {
        return Collections.unmodifiableList(variations);
    }

    public void setVariations(List<Variation> variations) {
        this.variations = variations != null ? new ArrayList<>(variations) : new ArrayList<>();
    }

    public void addVariation(Variation variation) {
        if (variation != null) {
            this.variations.add(variation);
        }
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        MenuItem menuItem = (MenuItem) o;
        return Objects.equals(id, menuItem.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "MenuItem{" +
                "id=" + id +
                ", name='" + name + '\'' +
                ", category='" + category + '\'' +
                ", sellPrice=" + sellPrice +
                ", inStock=" + inStock +
                '}';
    }
}

