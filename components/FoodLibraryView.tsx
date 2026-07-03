"use client";

import React, { useState } from "react";
import { useAppContext } from "@/lib/AppContext";
import { Plus, Edit2, Trash2, X, ChefHat, Image as ImageIcon, Utensils } from "lucide-react";

export default function FoodLibraryView() {
  const {
    items,
    packages,
    showItemForm,
    setShowItemForm,
    showPackageForm,
    setShowPackageForm,
    itemForm,
    setItemForm,
    packageForm,
    setPackageForm,
    handleSaveItem,
    handleEditItem,
    handleDeleteItem,
    handleToggleItemAvailability,
    handleSavePackage,
    handleEditPackage,
    handleDeletePackage,
    handleTogglePackageItemId,
    currentUser,
    currencySymbol
  } = useAppContext();

  // Prevent any key entry that is not a digit or a single decimal point (for prices)
  const restrictToDecimalsOnly = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowed = [
      "Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Enter", "Home", "End"
    ];
    if (allowed.includes(e.key) || ((e.ctrlKey || e.metaKey) && ["a", "c", "v", "x", "z"].includes(e.key.toLowerCase()))) {
      return;
    }
    if (e.key === ".") {
      const val = e.currentTarget.value;
      if (val.includes(".")) {
        e.preventDefault();
      }
      return;
    }
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const isManager = currentUser?.role === "manager";
  const [activeLibraryTab, setActiveLibraryTab] = useState<"dishes" | "packages">("dishes");
  const [dishSearchQuery, setDishSearchQuery] = useState("");

  const getCategoryBadgeClass = (category: string) => {
    const normalized = (category || "").toLowerCase().trim();
    if (normalized === "appetizer") return "badge-appetizer";
    if (normalized === "main course") return "badge-main-course";
    if (normalized === "dessert") return "badge-dessert";
    if (normalized === "beverage") return "badge-beverage";
    return "badge-info";
  };

  const selectedDishesSum = packageForm.selectedItemIds.reduce((sum, id) => {
    const dish = items.find((i) => i.id === id);
    return sum + (dish?.price || 0);
  }, 0);

  return (
    <div className="library-container">
      <header className="library-header">
        <div>
          <h1 className="library-title">
            Food Library &amp; Packages
          </h1>
          <p className="library-subtitle">
            Manage individual items, seasonal availabilities, and set menu templates.
          </p>
        </div>
        {!isManager && (
          <div className="actions-row">
            {activeLibraryTab === "dishes" && !showItemForm && (
              <button 
                className="btn btn-primary btn-sm btn-icon-label" 
                onClick={() => setShowItemForm(true)}
              >
                <Plus size={14} /> Add Food Item
              </button>
            )}
            {activeLibraryTab === "packages" && !showPackageForm && (
              <button 
                className="btn btn-primary btn-sm btn-icon-label" 
                onClick={() => setShowPackageForm(true)}
              >
                <Plus size={14} /> Create Package Set
              </button>
            )}
          </div>
        )}
      </header>

      {/* Tab controls */}
      <div className="toggle-group" style={{ marginBottom: "1.5rem" }}>
        <button 
          className={`toggle-group-btn ${activeLibraryTab === "dishes" ? "active" : ""}`}
          onClick={() => setActiveLibraryTab("dishes")}
        >
          Dish Library
        </button>
        <button 
          className={`toggle-group-btn ${activeLibraryTab === "packages" ? "active" : ""}`}
          onClick={() => setActiveLibraryTab("packages")}
        >
          Preset Package Bundles
        </button>
      </div>

      {activeLibraryTab === "dishes" ? (
        <div className="library-content-split">
          {/* Dishes List Column */}
          <div className="library-main-list-column">
            <div className="library-column">
              <div className="library-column-list">
                {items.length === 0 ? (
                  <div className="empty-state-card">
                    <div className="empty-state-icon-wrapper">
                      <ChefHat size={18} />
                    </div>
                    <h4 className="empty-state-title">
                      Dish Library is Empty
                    </h4>
                    <p className="empty-state-desc">
                      Add individual mains, appetizers, or desserts to populate your catering dish database.
                    </p>
                    {!showItemForm && !isManager && (
                      <button 
                        onClick={() => setShowItemForm(true)}
                        className="btn btn-secondary btn-sm btn-icon-label"
                      >
                        <Plus size={12} /> Add Food Item
                      </button>
                    )}
                  </div>
                ) : (
                  items.map((item) => (
                    <div 
                      key={item.id} 
                      className={`glass-card dish-card ${!item.is_available ? "unavailable" : ""}`}
                    >
                      {!item.is_available && (
                        <span className="badge badge-warning dish-season-badge">
                          Out of Season
                        </span>
                      )}
                      
                      <div className="dish-card-body">
                        {item.image ? (
                          <img 
                            src={item.image} 
                            alt={item.name} 
                            className="dish-thumbnail" 
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                              const parent = (e.target as HTMLElement).parentElement;
                              if (parent && !parent.querySelector(".dish-thumbnail-placeholder")) {
                                const placeholder = document.createElement("div");
                                placeholder.className = "dish-thumbnail-placeholder";
                                placeholder.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chef-hat"><path d="M6 18H18v3H6v-3z"/><path d="M12 2A6 6 0 0 0 6 8v3a6 6 0 0 0 12 0V8A6 6 0 0 0 12 2z"/></svg>`;
                                parent.appendChild(placeholder);
                              }
                            }}
                          />
                        ) : (
                          <div className="dish-thumbnail-placeholder">
                            <ChefHat size={24} />
                          </div>
                        )}
                        <div className="dish-info">
                          <h4 className="dish-name">{item.name}</h4>
                          <span className={`badge dish-type-tag ${getCategoryBadgeClass(item.type)}`}>
                            {item.type}
                          </span>
                          <div className="dish-ingredients-box">
                            <strong>Ingredients:</strong> {item.ingredients || "Not configured."}
                          </div>
                          <div className="dish-pricing-box">
                            <span><strong>Serving:</strong> {item.style || "Buffet"}</span>
                            <span><strong>Price:</strong> {currencySymbol}{item.price !== undefined ? item.price : "0.00"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="dish-card-footer">
                        <label className="availability-toggle">
                          <input 
                            type="checkbox" 
                            disabled={isManager}
                            checked={item.is_available} 
                            onChange={() => handleToggleItemAvailability(item.id, item.is_available)} 
                            className="rounded-checkbox"
                          />
                          <span className="availability-label">
                            {item.is_available ? "In Season" : "Out of Season"}
                          </span>
                        </label>

                        {!isManager && (
                          <div className="action-buttons-group">
                            <button 
                              className="btn btn-secondary btn-sm btn-icon-label" 
                              onClick={() => handleEditItem(item)}
                            >
                              <Edit2 size={12} /> Edit
                            </button>
                            <button 
                              className="btn btn-danger btn-sm btn-icon-label" 
                              onClick={() => handleDeleteItem(item.id)}
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Add/Edit Form Sidebar Column */}
          {showItemForm && !isManager && (
            <div className="library-form-sidebar-column">
              <div className="glass-card">
                <h3 className="form-title">
                  {itemForm.id ? "Edit Dish Detail" : "Add Individual Dish"}
                </h3>
                <form onSubmit={handleSaveItem} className="library-form">
                  <div className="form-group">
                    <label className="form-label">Dish Name *</label>
                    <input
                      className="form-input"
                      type="text"
                      required
                      value={itemForm.name}
                      onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Category Type *</label>
                    <select
                      className="form-input"
                      value={itemForm.type}
                      onChange={(e) => setItemForm({ ...itemForm, type: e.target.value })}
                    >
                      <option value="Appetizer">Appetizer</option>
                      <option value="Main Course">Main Course</option>
                      <option value="Bread">Bread</option>
                      <option value="Salad">Salad</option>
                      <option value="Dessert">Dessert</option>
                      <option value="Beverage">Beverage</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Service Style</label>
                    <input
                      className="form-input"
                      type="text"
                      placeholder="e.g. Live Counter, Buffet, Plated"
                      value={itemForm.style}
                      onChange={(e) => setItemForm({ ...itemForm, style: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Price per Plate ({currencySymbol}) *</label>
                    <input
                      className="form-input"
                      type="number"
                      step="0.01"
                      min="0"
                      onKeyDown={restrictToDecimalsOnly}
                      required
                      value={itemForm.price}
                      onChange={(e) => setItemForm({ ...itemForm, price: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="form-group-checkbox">
                    <label className="form-checkbox-label">
                      <input
                        type="checkbox"
                        className="rounded-checkbox"
                        checked={itemForm.is_available}
                        onChange={(e) => setItemForm({ ...itemForm, is_available: e.target.checked })}
                      />
                      <span>Available (In Season)</span>
                    </label>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Ingredients &amp; Recipe details *</label>
                    <textarea
                      className="form-input text-area"
                      rows={3}
                      placeholder="Input format like: 100g paneer, 20g capsicum, 5g cashew paste. List item amount per client plate."
                      required
                      value={itemForm.ingredients}
                      onChange={(e) => setItemForm({ ...itemForm, ingredients: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Thumbnail Image Web URL</label>
                    <input
                      className="form-input"
                      type="text"
                      placeholder="Copy paste a web image link"
                      value={itemForm.image}
                      onChange={(e) => setItemForm({ ...itemForm, image: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Special Notes</label>
                    <input
                      className="form-input"
                      type="text"
                      placeholder="e.g. Serve hot with mint chutney"
                      value={itemForm.notes}
                      onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })}
                    />
                  </div>

                  <div className="form-actions-wrapper">
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={() => {
                        setShowItemForm(false);
                        setItemForm({ id: "", name: "", type: "Appetizer", ingredients: "", style: "Buffet", image: "", notes: "", price: 0, is_available: true });
                      }}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Save Dish
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="library-content-split">
          {/* Preset Packages List Column */}
          <div className="library-main-list-column">
            <div className="library-column">
              <div className="library-column-list">
                {packages.length === 0 ? (
                  <div className="empty-state-card">
                    <div className="empty-state-icon-wrapper">
                      <Utensils size={18} />
                    </div>
                    <h4 className="empty-state-title">
                      No Package Bundles
                    </h4>
                    <p className="empty-state-desc">
                      Create preset menu templates (e.g. Buffet, High Tea) to quickly assign items to orders.
                    </p>
                    {!showPackageForm && !isManager && (
                      <button 
                        onClick={() => setShowPackageForm(true)}
                        className="btn btn-secondary btn-sm btn-icon-label"
                      >
                        <Plus size={12} /> Create Package Set
                      </button>
                    )}
                  </div>
                ) : (
                  packages.map((pkg) => {
                    const pkgPrice = (pkg.price !== null && pkg.price !== undefined && pkg.price > 0)
                      ? pkg.price
                      : (pkg.items ?? []).reduce((sum, it) => sum + (it.price || 0), 0);

                    return (
                      <div key={pkg.id} className="glass-card package-card">
                        <div className="package-card-header">
                          <div>
                            <div className="package-title-row">
                              <h4 className="package-name">{pkg.name}</h4>
                              <span className="badge badge-info package-price-tag">
                                {currencySymbol}{pkgPrice}
                              </span>
                            </div>
                            <p className="package-desc">
                              {pkg.description || "No description."}
                            </p>
                          </div>
                          {!isManager && (
                            <div className="action-buttons-group" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                              <button 
                                className="btn btn-secondary btn-sm btn-icon-label" 
                                onClick={() => handleEditPackage(pkg)}
                              >
                                <Edit2 size={12} /> Edit
                              </button>
                              <button 
                                className="btn btn-danger btn-sm btn-icon-label" 
                                onClick={() => handleDeletePackage(pkg.id)}
                              >
                                <Trash2 size={12} /> Delete
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="package-card-items-section">
                          <span className="section-mini-header">
                            Included Menu Items
                          </span>
                          <div className="package-items-tags-wrapper">
                            {pkg.items && pkg.items.map((it) => (
                              <span 
                                key={it.id} 
                                className={`package-item-tag badge ${getCategoryBadgeClass(it.type || "")}`}
                              >
                                {it.name}
                              </span>
                            ))}
                            {(!pkg.items || pkg.items.length === 0) && (
                              <span className="no-items-label">No items included.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Create Package Set Form Sidebar Column */}
          {showPackageForm && !isManager && (
            <div className="library-form-sidebar-column">
              <div className="glass-card">
                <h3 className="form-title">{packageForm.id ? "Edit Package Set" : "Create New Package Set"}</h3>
                <form onSubmit={handleSavePackage} className="library-form">
                  <div className="form-group">
                    <label className="form-label">Package Name *</label>
                    <input
                      className="form-input"
                      type="text"
                      required
                      placeholder="e.g. Royal Veg Platter"
                      value={packageForm.name}
                      onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Package Description</label>
                    <input
                      className="form-input"
                      type="text"
                      placeholder="e.g. Premium Veg Buffet including Paneer Tikka"
                      value={packageForm.description}
                      onChange={(e) => setPackageForm({ ...packageForm, description: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Package Price Override ({currencySymbol})</label>
                    <input
                      className="form-input"
                      type="number"
                      step="0.01"
                      min="0"
                      onKeyDown={restrictToDecimalsOnly}
                      placeholder={`Leave blank to auto-calculate (${currencySymbol}${selectedDishesSum})`}
                      value={packageForm.price}
                      onChange={(e) => setPackageForm({ ...packageForm, price: e.target.value })}
                    />
                    <span className="package-price-calculation-hint">
                      Default calculated sum of dishes: <strong>{currencySymbol}{selectedDishesSum}</strong>
                    </span>
                  </div>

                   <div className="form-group">
                    <label className="form-label">Select default dishes to include in bundle</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontSize: "0.8rem", width: "100%", marginBottom: "0.5rem" }}
                      placeholder="Search dishes to select..."
                      value={dishSearchQuery}
                      onChange={(e) => setDishSearchQuery(e.target.value)}
                    />
                    <div className="package-dish-selector-grid" style={{ maxHeight: "250px", overflowY: "auto", border: "1px solid var(--border-ink)", padding: "0.5rem", borderRadius: "var(--radius-sm)" }}>
                      {items.filter(it => it.name.toLowerCase().includes(dishSearchQuery.toLowerCase())).map((it) => {
                        const isChecked = packageForm.selectedItemIds.includes(it.id);
                        return (
                          <label key={it.id} className="form-checkbox-label p-1" style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem", cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleTogglePackageItemId(it.id)}
                              className="rounded-checkbox"
                            />
                            <span>{it.name}</span>
                            <span className={`badge ${getCategoryBadgeClass(it.type)}`} style={{ fontSize: "0.6rem", padding: "0.1rem 0.3rem", textTransform: "lowercase", marginLeft: "auto" }}>
                              {it.type}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="form-actions-wrapper">
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={() => {
                        setShowPackageForm(false);
                        setPackageForm({ id: "", name: "", description: "", price: "", selectedItemIds: [] });
                      }}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      {packageForm.id ? "Save Package" : "Create Package"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
