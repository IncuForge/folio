import type { ReactNode } from "react";
import ClientAppLayout from "@/app/ClientAppLayout";
import { AppContextProvider } from "@/lib/AppContext";
import DashboardView from "@/components/DashboardView";
import CalendarView from "@/components/CalendarView";
import OrdersBookView from "@/components/OrdersBookView";
import FoodLibraryView from "@/components/FoodLibraryView";
import OrderFormView from "@/components/OrderFormView";
import ReportsView from "@/components/ReportsView";
import SettingsView from "@/components/SettingsView";
import { usePathname } from "next/navigation";
import DesktopTitleBar from "./DesktopTitleBar";

function CurrentView() {
  const pathname = usePathname();
  const views: Record<string, ReactNode> = {
    "/": <DashboardView />, "/calendar": <CalendarView />, "/orders": <OrdersBookView />,
    "/library": <FoodLibraryView />, "/order-form": <OrderFormView />,
    "/reports": <ReportsView />, "/settings": <SettingsView />,
  };
  return <div className="tab-content-animate">{views[pathname] || <DashboardView />}</div>;
}

export default function App() {
  return (
    <div className="desktop-shell">
      <DesktopTitleBar />
      <AppContextProvider>
        <ClientAppLayout><CurrentView /></ClientAppLayout>
      </AppContextProvider>
    </div>
  );
}
