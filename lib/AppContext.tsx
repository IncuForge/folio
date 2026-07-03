"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Item, Package, Order, AdditionalCharge } from "@/types/schema";

interface AppContextType {
  currentUser: { id: string; email: string; role: string } | null;
  setCurrentUser: (user: { id: string; email: string; role: string } | null) => void;
  
  items: Item[];
  packages: Package[];
  orders: Order[];
  
  fetchItems: () => Promise<void>;
  fetchPackages: () => Promise<void>;
  fetchOrders: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  
  // Navigation
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  toggleTheme: () => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (val: boolean) => void;

  // Global selections
  selectedOrder: Order | null;
  setSelectedOrder: (order: Order | null) => void;
  printMenuOrder: Order | null;
  setPrintMenuOrder: (order: Order | null) => void;
  pdfBrandName: string;
  setPdfBrandName: (name: string) => void;
  currencySymbol: string;
  setCurrencySymbol: (val: string) => void;
  paymentMethods: string[];
  setPaymentMethods: (methods: string[]) => void;
  kitchenSheetOrder: Order | null;
  setKitchenSheetOrder: (order: Order | null) => void;
  
  // Forms & helpers
  itemForm: typeof initialItemForm;
  setItemForm: React.Dispatch<React.SetStateAction<typeof initialItemForm>>;
  showItemForm: boolean;
  setShowItemForm: (val: boolean) => void;
  
  packageForm: typeof initialPackageForm;
  setPackageForm: React.Dispatch<React.SetStateAction<typeof initialPackageForm>>;
  showPackageForm: boolean;
  setShowPackageForm: (val: boolean) => void;
  
  orderForm: typeof initialOrderForm;
  setOrderForm: React.Dispatch<React.SetStateAction<typeof initialOrderForm>>;
  orderSearchQuery: string;
  setOrderSearchQuery: (q: string) => void;
  cancellationLockModal: { show: boolean; orderId: string; message: string } | null;
  setCancellationLockModal: (val: { show: boolean; orderId: string; message: string } | null) => void;
  
  dashboardScheduleTab: "upcoming" | "past";
  setDashboardScheduleTab: (tab: "upcoming" | "past") => void;
  currentMonth: Date;
  setCurrentMonth: (date: Date) => void;
  
  // Operations handlers
  handleSaveItem: (e: React.FormEvent) => Promise<void>;
  handleEditItem: (item: Item) => void;
  handleDeleteItem: (id: string) => Promise<void>;
  handleToggleItemAvailability: (id: string, currentVal: boolean) => Promise<void>;
  
  handleSavePackage: (e: React.FormEvent) => Promise<void>;
  handleEditPackage: (pkg: any) => void;
  handleDeletePackage: (id: string) => Promise<void>;
  handleTogglePackageItemId: (id: string) => void;
  
  handleNewOrder: () => void;
  handleEditOrder: (order: Order) => void;
  handleCloneOrder: (id: string) => Promise<void>;
  handleDeleteOrder: (id: string, override?: boolean) => Promise<void>;
  handleApplyPackageTemplate: (packageId: string) => void;
  handleAddOrderItem: (itemId: string) => void;
  handleRemoveOrderItem: (itemId: string) => void;
  handleUpdateOrderItemQty: (itemId: string, qty: number) => void;
  handleUpdateOrderItemNotes: (itemId: string, noteText: string) => void;
  handleAddChargeLine: () => void;
  handleUpdateChargeLine: (index: number, label: string, amount: number) => void;
  handleRemoveChargeLine: (index: number) => void;
  handleSaveOrder: (e: React.FormEvent) => Promise<void>;
  handleUpdateOrderStatus: (id: string, status: string) => Promise<void>;
  handleLogout: () => Promise<void>;
}

const initialItemForm = {
  id: "",
  name: "",
  type: "Appetizer",
  ingredients: "",
  style: "Buffet",
  image: "",
  notes: "",
  price: 0,
  is_available: true,
};

const initialPackageForm = {
  id: "",
  name: "",
  description: "",
  price: "" as string | number,
  selectedItemIds: [] as string[],
};

const initialOrderForm = {
  id: "",
  client_name: "",
  client_phone: "",
  event_name: "",
  event_date: "",
  event_end_date: "",
  event_time: "",
  venue: "",
  guest_count: 50,
  notes: "",
  status: "pending",
  additional_charges: [] as AdditionalCharge[],
  booking_paid: false,
  booking_amount: 0,
  booking_payment_notes: "",
  second_paid: false,
  second_amount: 0,
  second_payment_notes: "",
  final_paid: false,
  final_amount: 0,
  final_payment_notes: "",
  package_id: "" as string | null,
  package_price: 0,
  packages_selected: [] as Array<{ packageId: string; quantity: number; price: number }>,
  sessions: [] as any[],
  items: [] as { itemId: string; quantity: number; notes: string }[],
  discount_percent: 0,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppContextProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; role: string } | null>(null);
  
  const [items, setItems] = useState<Item[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  
  const router = useRouter();
  const pathname = usePathname();

  // Navigation & UI Layout
  const [activeTab, setActiveTabState] = useState<string>("dashboard");
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  useEffect(() => {
    if (pathname === "/") {
      setActiveTabState("dashboard");
    } else {
      const tabName = pathname.substring(1);
      setActiveTabState(tabName || "dashboard");
    }
  }, [pathname]);

  const setActiveTab = (tab: string) => {
    const path = tab === "dashboard" ? "/" : `/${tab}`;
    router.push(path);
  };
  
  // Selection states
  const [selectedOrder, _setSelectedOrder] = useState<Order | null>(null);

  const selectedOrderRef = useRef<Order | null>(null);

  const setSelectedOrder = useCallback((order: Order | null) => {
    const prevOrder = selectedOrderRef.current;
    selectedOrderRef.current = order;

    const getActiveElement = (oId: string) => {
      return document.getElementById(`order-row-${oId}`) || 
             document.getElementById(`calendar-event-${oId}`) ||
             document.getElementById(`warning-row-${oId}`);
    };

    if (typeof document !== "undefined" && (document as any).startViewTransition) {
      if (order) {
        const el = getActiveElement(order.id);
        if (el) {
          el.style.viewTransitionName = "active-order-modal";
        }
        (document as any).startViewTransition(() => {
          if (el) {
            el.style.viewTransitionName = "";
          }
          _setSelectedOrder(order);
        });
      } else if (prevOrder) {
        const el = getActiveElement(prevOrder.id);
        const transition = (document as any).startViewTransition(() => {
          if (el) {
            el.style.viewTransitionName = "active-order-modal";
          }
          _setSelectedOrder(null);
        });
        transition.finished.finally(() => {
          if (el) {
            el.style.viewTransitionName = "";
          }
        });
      } else {
        (document as any).startViewTransition(() => {
          _setSelectedOrder(null);
        });
      }
    } else {
      _setSelectedOrder(order);
    }
  }, []);
  const [printMenuOrder, setPrintMenuOrder] = useState<Order | null>(null);
  const [pdfBrandName, setPdfBrandName] = useState<string>("Cater Flow Premium Catering");
  const [currencySymbol, setCurrencySymbolState] = useState<string>("₹");
  const [paymentMethods, setPaymentMethodsState] = useState<string[]>(["UPI", "Cash", "Card", "Bank Transfer", "Cheque"]);

  const setPaymentMethods = async (methods: string[]) => {
    setPaymentMethodsState(methods);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethods: methods })
      });
    } catch (e) {
      console.error("Error saving payment methods", e);
    }
  };

  const setCurrencySymbol = async (val: string) => {
    setCurrencySymbolState(val);
    
    let defaults = ["Bank Transfer", "Cash", "Card", "Cheque", "Other"];
    if (val === "₹") {
      defaults = ["UPI", "Cash", "Card", "Bank Transfer", "Cheque"];
    } else if (val === "$") {
      defaults = ["Zelle", "Venmo", "Cash", "Card", "PayPal", "Cheque"];
    } else if (val === "€" || val === "£") {
      defaults = ["Bank Transfer", "Cash", "Card", "PayPal", "Cheque"];
    }
    setPaymentMethodsState(defaults);

    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currencySymbol: val, paymentMethods: defaults })
      });
    } catch (e) {
      console.error("Error saving currency symbol", e);
    }
  };
  const [kitchenSheetOrder, setKitchenSheetOrder] = useState<Order | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  
  // CRUD form states
  const [itemForm, setItemForm] = useState(initialItemForm);
  const [showItemForm, setShowItemForm] = useState(false);
  
  const [packageForm, setPackageForm] = useState(initialPackageForm);
  const [showPackageForm, setShowPackageForm] = useState(false);
  
  const [orderForm, setOrderForm] = useState(initialOrderForm);
  const [orderSearchQuery, setOrderSearchQuery] = useState("");
  const [cancellationLockModal, setCancellationLockModal] = useState<{
    show: boolean;
    orderId: string;
    message: string;
  } | null>(null);
  
  const [dashboardScheduleTab, setDashboardScheduleTab] = useState<"upcoming" | "past">("upcoming");

  const toggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  // API Call wrappers
  const fetchItems = async () => {
    try {
      const res = await fetch("/api/items");
      const data = await res.json();
      if (Array.isArray(data)) setItems(data);
    } catch (e) {
      console.error("Error fetching items", e);
    }
  };

  const fetchPackages = async () => {
    try {
      const res = await fetch("/api/packages");
      const data = await res.json();
      if (Array.isArray(data)) setPackages(data);
    } catch (e) {
      console.error("Error fetching packages", e);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (Array.isArray(data)) setOrders(data);
    } catch (e) {
      console.error("Error fetching orders", e);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.pdfBrandName !== undefined) setPdfBrandName(data.pdfBrandName);
        if (data.currencySymbol !== undefined) setCurrencySymbolState(data.currencySymbol);
        if (data.paymentMethods !== undefined) {
          try {
            const parsed = typeof data.paymentMethods === "string" ? JSON.parse(data.paymentMethods) : data.paymentMethods;
            if (Array.isArray(parsed)) setPaymentMethodsState(parsed);
          } catch (e) {
            console.error("Error parsing payment methods", e);
          }
        }
      }
    } catch (e) {
      console.error("Error fetching settings", e);
    }
  };

  // Item Form CRUD Handlers
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.name || !itemForm.type) return;

    try {
      const url = itemForm.id ? `/api/items/${itemForm.id}` : "/api/items";
      const method = itemForm.id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemForm),
      });

      if (res.ok) {
        setItemForm(initialItemForm);
        setShowItemForm(false);
        fetchItems();
      }
    } catch (e) {
      console.error("Error saving item", e);
    }
  };

  const handleEditItem = (item: Item) => {
    setItemForm({
      id: item.id,
      name: item.name,
      type: item.type,
      ingredients: item.ingredients || "",
      style: item.style || "Buffet",
      image: item.image || "",
      notes: item.notes || "",
      price: item.price || 0,
      is_available: item.is_available ?? true,
    });
    setShowItemForm(true);
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Are you sure you want to delete this food item?")) return;
    try {
      const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
      if (res.ok) fetchItems();
    } catch (e) {
      console.error("Error deleting item", e);
    }
  };

  const handleToggleItemAvailability = async (id: string, currentVal: boolean) => {
    // Optimistic update — flip the local state immediately for instant feedback
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, is_available: !currentVal } : item
      )
    );
    try {
      const res = await fetch(`/api/items/${id}/availability`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_available: !currentVal }),
      });
      if (!res.ok) {
        // Roll back on API failure
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, is_available: currentVal } : item
          )
        );
        console.error("Failed to toggle item availability, rolling back.");
      }
    } catch (e) {
      // Roll back on network error
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, is_available: currentVal } : item
        )
      );
      console.error("Error toggling item availability", e);
    }
  };

  // Package Form CRUD Handlers
  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!packageForm.name) return;

    try {
      const isEdit = !!packageForm.id;
      const url = isEdit ? `/api/packages/${packageForm.id}` : "/api/packages";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: packageForm.name,
          description: packageForm.description,
          price: packageForm.price ? parseFloat(packageForm.price as string) : null,
          itemIds: packageForm.selectedItemIds,
        }),
      });

      if (res.ok) {
        setPackageForm(initialPackageForm);
        setShowPackageForm(false);
        fetchPackages();
      }
    } catch (e) {
      console.error("Error saving package", e);
    }
  };

  const handleEditPackage = (pkg: any) => {
    setPackageForm({
      id: pkg.id,
      name: pkg.name || "",
      description: pkg.description || "",
      price: pkg.price !== null && pkg.price !== undefined ? pkg.price.toString() : "",
      selectedItemIds: (pkg.items ?? []).map((it: any) => it.id),
    });
    setShowPackageForm(true);
  };

  const handleDeletePackage = async (id: string) => {
    if (!confirm("Are you sure you want to delete this package template?")) return;
    try {
      const res = await fetch(`/api/packages/${id}`, { method: "DELETE" });
      if (res.ok) fetchPackages();
    } catch (e) {
      console.error("Error deleting package", e);
    }
  };

  const handleTogglePackageItemId = (id: string) => {
    setPackageForm((prev) => {
      const index = prev.selectedItemIds.indexOf(id);
      if (index > -1) {
        return {
          ...prev,
          selectedItemIds: prev.selectedItemIds.filter((x) => x !== id),
        };
      } else {
        return {
          ...prev,
          selectedItemIds: [...prev.selectedItemIds, id],
        };
      }
    });
  };

  // Order Form CRUD Handlers
  const handleNewOrder = () => {
    setOrderForm(initialOrderForm);
    setActiveTab("order-form");
  };

  const handleEditOrder = (order: Order) => {
    setOrderForm({
      id: order.id,
      client_name: order.client_name,
      client_phone: order.client_phone || "",
      event_name: order.event_name,
      event_date: order.event_date,
      event_end_date: order.event_end_date || "",
      event_time: order.event_time || "",
      venue: order.venue || "",
      guest_count: order.guest_count,
      notes: order.notes || "",
      status: order.status,
      additional_charges: order.additional_charges || [],
      booking_paid: order.booking_paid === true || (order.booking_paid as any) === 1,
      booking_amount: order.booking_amount,
      booking_payment_notes: order.booking_payment_notes || "",
      second_paid: order.second_paid === true || (order.second_paid as any) === 1,
      second_amount: order.second_amount,
      second_payment_notes: order.second_payment_notes || "",
      final_paid: order.final_paid === true || (order.final_paid as any) === 1,
      final_amount: order.final_amount,
      final_payment_notes: order.final_payment_notes || "",
      package_id: order.package_id || "",
      package_price: order.package_price || 0,
      packages_selected: order.packages_selected || [],
      sessions: order.sessions || [],
      items: (order.items || []).map((it) => ({
        itemId: it.item_id,
        quantity: it.quantity,
        notes: it.item_notes || "",
      })),
      discount_percent: order.discount_percent || 0,
    });
    setActiveTab("order-form");
  };

  const handleCloneOrder = async (id: string) => {
    try {
      const res = await fetch(`/api/orders/${id}/clone`, { method: "POST" });
      if (res.ok) {
        fetchOrders();
      }
    } catch (e) {
      console.error("Error cloning order", e);
    }
  };

  const handleDeleteOrder = async (id: string, override = false) => {
    try {
      const url = `/api/orders/${id}${override ? "?override=true" : ""}`;
      const res = await fetch(url, { method: "DELETE" });

      if (res.ok) {
        setCancellationLockModal(null);
        fetchOrders();
      } else {
        const errorData = await res.json();
        if (errorData.error === "cancellation_lock") {
          setCancellationLockModal({
            show: true,
            orderId: id,
            message: errorData.message,
          });
        } else {
          alert(errorData.error || "An error occurred");
        }
      }
    } catch (e) {
      console.error("Error deleting order", e);
    }
  };

  const handleApplyPackageTemplate = (packageId: string) => {
    if (!packageId) {
      setOrderForm((prev) => ({
        ...prev,
        package_id: "",
        package_price: 0,
      }));
      return;
    }
    const pkg = packages.find((p) => p.id === packageId);
    if (!pkg || !pkg.items) return;

    const guestCount = orderForm.guest_count || 50;
    const defaultItems = pkg.items.map((it) => ({
      itemId: it.id,
      quantity: guestCount,
      notes: "",
    }));

    // Calculate package price: override custom price, otherwise sum of its dishes
    const calculatedPrice = (pkg.price !== null && pkg.price !== undefined && pkg.price > 0)
      ? pkg.price
      : pkg.items.reduce((sum, it) => sum + (it.price || 0), 0);

    setOrderForm((prev) => ({
      ...prev,
      package_id: pkg.id,
      package_price: calculatedPrice,
      items: defaultItems,
    }));
  };

  const handleAddOrderItem = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    if (!item.is_available) {
      alert(`⚠️ Note: "${item.name}" is currently marked as out of season/unavailable. Make sure ingredients will be available on the event date.`);
    }

    setOrderForm((prev) => {
      const exists = prev.items.find((x) => x.itemId === itemId);
      if (exists) return prev;

      return {
        ...prev,
        items: [
          ...prev.items,
          {
            itemId,
            quantity: prev.guest_count || 50,
            notes: "",
          },
        ],
      };
    });
  };

  const handleRemoveOrderItem = (itemId: string) => {
    setOrderForm((prev) => ({
      ...prev,
      items: prev.items.filter((x) => x.itemId !== itemId),
    }));
  };

  const handleUpdateOrderItemQty = (itemId: string, qty: number) => {
    setOrderForm((prev) => ({
      ...prev,
      items: prev.items.map((x) => (x.itemId === itemId ? { ...x, quantity: qty } : x)),
    }));
  };

  const handleUpdateOrderItemNotes = (itemId: string, noteText: string) => {
    setOrderForm((prev) => ({
      ...prev,
      items: prev.items.map((x) => (x.itemId === itemId ? { ...x, notes: noteText } : x)),
    }));
  };

  const handleAddChargeLine = () => {
    setOrderForm((prev) => ({
      ...prev,
      additional_charges: [...prev.additional_charges, { label: "Additional Charge", amount: 0 }],
    }));
  };

  const handleUpdateChargeLine = (index: number, label: string, amount: number) => {
    setOrderForm((prev) => {
      const nextCharges = [...prev.additional_charges];
      nextCharges[index] = { label, amount };
      return {
        ...prev,
        additional_charges: nextCharges,
      };
    });
  };

  const handleRemoveChargeLine = (index: number) => {
    setOrderForm((prev) => ({
      ...prev,
      additional_charges: prev.additional_charges.filter((_, idx) => idx !== index),
    }));
  };

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderForm.client_name || !orderForm.event_name || !orderForm.event_date) {
      alert("Please fill in all required fields (Client Name, Event Name, Event Date).");
      return;
    }

    try {
      const url = orderForm.id ? `/api/orders/${orderForm.id}` : "/api/orders";
      const method = orderForm.id ? "PATCH" : "POST";

      // Consolidate items from all sessions for relational database compatibility
      const consolidatedItems: Array<{ itemId: string; quantity: number; notes: string }> = [];
      const seen = new Map<string, { itemId: string; quantity: number; notes: string }>();

      if (orderForm.sessions && orderForm.sessions.length > 0) {
        for (const sess of orderForm.sessions) {
          if (Array.isArray(sess.items)) {
            for (const it of sess.items) {
              const key = `${it.itemId}-${it.notes || ""}`;
              if (seen.has(key)) {
                const existing = seen.get(key)!;
                existing.quantity += it.quantity;
              } else {
                seen.set(key, {
                  itemId: it.itemId,
                  quantity: it.quantity,
                  notes: it.notes || ""
                });
              }
            }
          }
        }
        consolidatedItems.push(...Array.from(seen.values()));
      }

      const snapshottedSessions = (orderForm.sessions || []).map((sess: any) => {
        const sessItems = (sess.items || []).map((it: any) => {
          const dish = items.find((d) => d.id === it.itemId);
          return {
            ...it,
            price: (it.price !== undefined && it.price !== null) ? Number(it.price) : (Number(dish?.price) || 0)
          };
        });
        return {
          ...sess,
          items: sessItems
        };
      });

      const payload = {
        ...orderForm,
        sessions: snapshottedSessions,
        items: consolidatedItems.length > 0 ? consolidatedItems : orderForm.items
      };
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        fetchOrders();
        setActiveTab("dashboard");
      } else {
        const err = await res.json();
        alert(err.error || "Failed to save order");
      }
    } catch (error) {
      console.error("Error saving order", error);
    }
  };

  const handleUpdateOrderStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        fetchOrders();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update order status");
      }
    } catch (error) {
      console.error("Error updating order status", error);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setCurrentUser(null);
      setActiveTab("dashboard");
    } catch (e) {
      console.error("Logout error", e);
    }
  };

  const contextValue = useMemo(() => ({
    currentUser,
    setCurrentUser,
    items,
    packages,
    orders,
    fetchItems,
    fetchPackages,
    fetchOrders,
    fetchSettings,
    activeTab,
    setActiveTab,
    isDarkMode,
    setIsDarkMode,
    toggleTheme,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    selectedOrder,
    setSelectedOrder,
    printMenuOrder,
    setPrintMenuOrder,
    pdfBrandName,
    setPdfBrandName,
    currencySymbol,
    setCurrencySymbol,
    paymentMethods,
    setPaymentMethods,
    kitchenSheetOrder,
    setKitchenSheetOrder,
    itemForm,
    setItemForm,
    showItemForm,
    setShowItemForm,
    packageForm,
    setPackageForm,
    showPackageForm,
    setShowPackageForm,
    orderForm,
    setOrderForm,
    orderSearchQuery,
    setOrderSearchQuery,
    cancellationLockModal,
    setCancellationLockModal,
    dashboardScheduleTab,
    setDashboardScheduleTab,
    currentMonth,
    setCurrentMonth,
    handleSaveItem,
    handleEditItem,
    handleDeleteItem,
    handleToggleItemAvailability,
    handleSavePackage,
    handleEditPackage,
    handleDeletePackage,
    handleTogglePackageItemId,
    handleNewOrder,
    handleEditOrder,
    handleCloneOrder,
    handleDeleteOrder,
    handleApplyPackageTemplate,
    handleAddOrderItem,
    handleRemoveOrderItem,
    handleUpdateOrderItemQty,
    handleUpdateOrderItemNotes,
    handleAddChargeLine,
    handleUpdateChargeLine,
    handleRemoveChargeLine,
    handleSaveOrder,
    handleUpdateOrderStatus,
    handleLogout,
  }), [
    currentUser,
    items,
    packages,
    orders,
    activeTab,
    isDarkMode,
    isSidebarCollapsed,
    selectedOrder,
    printMenuOrder,
    pdfBrandName,
    currencySymbol,
    paymentMethods,
    kitchenSheetOrder,
    itemForm,
    showItemForm,
    packageForm,
    showPackageForm,
    orderForm,
    orderSearchQuery,
    cancellationLockModal,
    dashboardScheduleTab,
    currentMonth,
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppContextProvider");
  }
  return context;
}
