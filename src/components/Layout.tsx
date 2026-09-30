
import { useState, useEffect } from "react";
import { useLocation, Outlet } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { SidebarNav } from "./navigation/SidebarNav";
import { Header } from "./navigation/Header";
import { UserMenu } from "./navigation/UserMenu";
import { ArgusProvider } from "./argus/ArgusProvider";
import { ArgusPanel } from "./argus/ArgusPanel";

export const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isMobile = useIsMobile();
  const location = useLocation();
  
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [location.pathname, isMobile]);
  
  return (
    <ArgusProvider>
      <div className="min-h-screen bg-background flex">
        <AnimatePresence>
          {sidebarOpen && isMobile && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </AnimatePresence>
      
        <SidebarNav 
          sidebarOpen={sidebarOpen} 
          setSidebarOpen={setSidebarOpen}
          onCollapsedChange={setSidebarCollapsed}
        />
      
        <div className={cn(
          // min-w-0: wide tables scroll inside their box instead of widening the page
          "flex-1 min-w-0 transition-all duration-300",
          !isMobile && (sidebarCollapsed ? "ml-16" : "ml-64")
        )}>
          <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        
          <main className="p-6">
            <Outlet />
          </main>
        </div>

        {/* Ask Argus: beside the page on desktop (pushing it narrower), over it on a phone */}
        <ArgusPanel />
      </div>
    </ArgusProvider>
  );
};
