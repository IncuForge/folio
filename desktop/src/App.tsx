import { useEffect, useState, type ReactNode } from "react";
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

function MobileBackGuard() {
  const [exitPrompt, setExitPrompt] = useState(false);

  useEffect(() => {
    const rootState = { ...(window.history.state || {}), folioRoot: true };
    window.history.replaceState(rootState, "", window.location.href);
    window.history.pushState({ ...rootState, folioGuard: true }, "", window.location.href);

    let lastBackAt = 0;
    let promptTimer: number | undefined;

    const restoreGuard = () => {
      window.history.pushState({ ...rootState, folioGuard: true }, "", window.location.href);
    };

    const handleBack = () => {
      const drawer = document.querySelector<HTMLElement>(".mobile-hamburger-drawer.open");
      if (drawer) {
        document.querySelector<HTMLButtonElement>('.mobile-actions button[title="Toggle Menu"]')?.click();
        restoreGuard();
        return;
      }

      const modalClose = document.querySelector<HTMLButtonElement>(".modal-overlay .btn-close-modal, .modal-overlay [data-mobile-back-close]");
      if (modalClose) {
        modalClose.click();
        restoreGuard();
        return;
      }

      if (window.location.pathname !== "/") return;

      const now = Date.now();
      if (now - lastBackAt < 2000) {
        void import("@tauri-apps/api/window").then(({ getCurrentWindow }) => getCurrentWindow().close());
        return;
      }

      lastBackAt = now;
      setExitPrompt(true);
      window.clearTimeout(promptTimer);
      promptTimer = window.setTimeout(() => setExitPrompt(false), 2000);
      restoreGuard();
    };

    window.addEventListener("popstate", handleBack);
    return () => {
      window.removeEventListener("popstate", handleBack);
      window.clearTimeout(promptTimer);
    };
  }, []);

  return exitPrompt ? <div className="mobile-exit-toast" role="status">Swipe back again to exit Folio</div> : null;
}
export default function App() {
  const [dataVersion, setDataVersion] = useState(0);
  const isNativeMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const reloadData = () => setDataVersion((current) => current + 1);
    window.addEventListener("folio-data-reloaded", reloadData);
    return () => window.removeEventListener("folio-data-reloaded", reloadData);
  }, []);

  return (
    <div className={isNativeMobile ? "native-mobile-shell" : "desktop-shell"}>
      {!isNativeMobile && <DesktopTitleBar />}
      {isNativeMobile && <MobileBackGuard />}
      <AppContextProvider key={dataVersion}>
        <ClientAppLayout><CurrentView /></ClientAppLayout>
      </AppContextProvider>
    </div>
  );
}
