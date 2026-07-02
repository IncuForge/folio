import { Order, Package } from "@/types/schema";

export function isTruthy(val: any): boolean {
  return val === true || val === 1 || val === "1" || val === "true";
}

export function getTodayDate(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export function parseEventDate(dateString: string): Date {
  if (!dateString) return new Date();
  const parts = dateString.split("-");
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day, 0, 0, 0, 0);
  }
  const d = new Date(dateString);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isPastEvent(dateString: string): boolean {
  const today = getTodayDate();
  const eventDate = parseEventDate(dateString);
  return eventDate.getTime() < today.getTime();
}

export function getDaysDifference(dateString: string): number {
  const today = getTodayDate();
  const eventDate = parseEventDate(dateString);
  const diffTime = eventDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getOrderPaymentStatusClass(order: Order): string {
  const isPast = isPastEvent(order.event_date);
  
  const booking_paid = isTruthy(order.booking_paid);
  const second_paid = isTruthy(order.second_paid);
  const final_paid = isTruthy(order.final_paid);

  if (booking_paid && second_paid && final_paid) {
    return "payment-paid";
  }

  if (isPast) {
    return "payment-overdue";
  }

  const diffDays = getDaysDifference(order.event_date);
  if (diffDays >= 0 && diffDays <= 3) {
    return "payment-urgent";
  }

  return "payment-active";
}

export function getOrderPaymentStatusLabel(order: Order): string {
  const isPast = isPastEvent(order.event_date);
  
  const booking_paid = isTruthy(order.booking_paid);
  const second_paid = isTruthy(order.second_paid);
  const final_paid = isTruthy(order.final_paid);

  if (booking_paid && second_paid && final_paid) {
    return "Fully Settled";
  }
  if (isPast) {
    return "Past Event (Outstanding)";
  }
  
  const diffDays = getDaysDifference(order.event_date);
  if (diffDays >= 0 && diffDays <= 3) {
    return `Urgent Collection (${diffDays} days to event)`;
  }

  return "On Schedule";
}

export function calculateBaseMenuCostOnly(order: Order, packages?: Package[]): number {
  let menuCost = 0;
  if (Array.isArray(order.sessions) && order.sessions.length > 0) {
    for (const session of order.sessions) {
      const pkg = packages?.find(p => p.id === session.package_id);
      const pkgItemIds = new Set(pkg?.items?.map(it => it.id) || []);

      let sessionCost = 0;
      if (session.package_id) {
        sessionCost += (Number(session.package_price) || 0) * (Number(session.guest_count) || 0);
      }

      const sessionItems = session.items || [];
      for (const it of sessionItems) {
        if (!session.package_id || !pkgItemIds.has(it.itemId)) {
          const matchedItem = order.items?.find(oi => oi.item_id === it.itemId);
          const price = (it.price !== undefined && it.price !== null) ? Number(it.price) : (Number(matchedItem?.price) || 0);
          sessionCost += price * (Number(it.quantity) || 0);
        }
      }
      menuCost += sessionCost;
    }
    return menuCost;
  }

  // 1. Multi-package selections check
  if (Array.isArray(order.packages_selected) && order.packages_selected.length > 0) {
    const basePackageCost = order.packages_selected.reduce((sum, pSel) => {
      return sum + (Number(pSel.price) || 0) * (Number(pSel.quantity) || 0);
    }, 0);

    const pkgItemIds = new Set<string>();
    order.packages_selected.forEach((pSel) => {
      const pkg = packages?.find((p) => p.id === pSel.packageId);
      pkg?.items?.forEach((it) => pkgItemIds.add(it.id));
    });

    let additionalDishesCost = 0;
    if (order.items && pkgItemIds.size > 0) {
      additionalDishesCost = order.items.reduce((sum, item) => {
        if (pkgItemIds.has(item.item_id)) {
          return sum; // Included in one of the selected packages
        }
        return sum + (Number(item.price) || 0) * (item.quantity || 0);
      }, 0);
    } else if (order.items) {
      additionalDishesCost = order.items.reduce((sum, item) => {
        return sum + (Number(item.price) || 0) * (item.quantity || 0);
      }, 0);
    }

    return basePackageCost + additionalDishesCost;
  }

  // 2. Single package fallback
  if (order.package_id) {
    const basePackageCost = (Number(order.package_price) || 0) * (order.guest_count || 0);
    
    const pkg = packages?.find((p) => p.id === order.package_id);
    const pkgItemIds = new Set(pkg?.items?.map((it) => it.id) || []);

    let additionalDishesCost = 0;
    if (order.items && pkgItemIds.size > 0) {
      additionalDishesCost = order.items.reduce((sum, item) => {
        if (pkgItemIds.has(item.item_id)) {
          return sum; // Included in package price
        }
        return sum + (Number(item.price) || 0) * (item.quantity || 0);
      }, 0);
    }
    
    return basePackageCost + additionalDishesCost;
  }

  // 3. Dishes only
  if (!order.items) return 0;
  const rawMenuCost = order.items.reduce((sum, item) => {
    return sum + (Number(item.price) || 0) * (item.quantity || 0);
  }, 0);
  return rawMenuCost;
}

export function calculateTotalOrderCost(order: Order, packages?: Package[]): number {
  const charges = Array.isArray(order.additional_charges)
    ? order.additional_charges.reduce((s, c) => s + (Number(c.amount) || 0), 0)
    : 0;

  const menuCost = calculateBaseMenuCostOnly(order, packages);
  const discountPercent = Number(order.discount_percent) || 0;
  const discountAmount = menuCost * (discountPercent / 100);
  const discountedMenuCost = menuCost - discountAmount;

  return discountedMenuCost + charges;
}

export function calculatePendingOrderCost(order: Order, packages?: Package[]): number {
  const totalAmount = calculateTotalOrderCost(order, packages);
  
  const booking_paid = isTruthy(order.booking_paid);
  const second_paid = isTruthy(order.second_paid);
  const final_paid = isTruthy(order.final_paid);
  
  const paidAmount = 
    (booking_paid ? (Number(order.booking_amount) || 0) : 0) +
    (second_paid ? (Number(order.second_amount) || 0) : 0) +
    (final_paid ? (Number(order.final_amount) || 0) : 0);
  
  return Math.max(0, totalAmount - paidAmount);
}
