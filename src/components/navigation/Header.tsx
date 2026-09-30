
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MenuIcon } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { common } from "@/i18n/common";
import { ArgusIcon } from "@/components/argus/ArgusIcon";
import { useArgus } from "@/components/argus/argusState";
import { ARGUS_PANEL_ID, ARGUS_TOGGLE_ID } from "@/components/argus/ArgusPanel";

/** The Ask Argus shortcut as this platform writes it. */
const ARGUS_SHORTCUT = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘I" : "Ctrl+I";

interface HeaderProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const Header = ({ sidebarOpen, setSidebarOpen }: HeaderProps) => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const argus = useArgus();
  
  const getPageTitle = () => {
    const path = location.pathname;

    if (path === "/") return "Dashboard";
    if (path === "/theatres" || path === "/theatres/list") return "Theatre List";
    if (path === "/theatres/flm-feeds") return "FLM Feeds";
    if (path.startsWith("/theatres/flm-feeds/")) return "FLM Feed Details";
    if (path.startsWith("/theatre/") && path.endsWith("/edit")) return "Edit Theatre";
    if (path === "/chains") return "Chains";
    if (path.startsWith("/chains/")) return "Edit Chain";

    // Devices Master
    if (path === "/theatre-device-management/screen-devices") return "Screen Device Management";
    if (path.startsWith("/theatre-device-management/screen-devices/") && path.endsWith("/edit"))
      return "Edit Screen Device List";
    if (path === "/theatre-device-management/tdl-devices" || path === "/tdl-devices") return "TDL Devices";
    if (path === "/theatre-device-management/credentials-manager") return "Credentials Manager";
    if (path.startsWith("/theatre-device-management/credentials-manager/") && path.endsWith("/credentials"))
      return "Edit Device Credentials";

    // Qube Appliances
    if (path === "/qube-appliances/wiretap") return "WireTAP Devices";
    if (path === "/qube-appliances/wiretap/add") return "Add WireTAP Device";
    if (path.startsWith("/qube-appliances/wiretap/") && path.endsWith("/edit")) return "Edit WireTAP Device";
    if (path === "/qube-appliances/qube-acs") return "Qube ACS";
    if (path.startsWith("/qube-appliances/qube-acs/add")) return "Add Qube ACS Theatre";
    if (path.startsWith("/qube-appliances/qube-acs/") && path.endsWith("/edit")) return "Edit Qube ACS Theatre";
    if (path === "/qube-appliances/pulse") return "Pulse";
    if (path.startsWith("/qube-appliances/pulse/add")) return "Add Pulse Theatre";
    if (path.startsWith("/qube-appliances/pulse/") && path.endsWith("/edit")) return "Edit Pulse Theatre";
    if (path === "/qube-appliances/edge") return "Edge";
    if (path.startsWith("/qube-appliances/edge/add")) return "Add Edge Theatre";
    if (path.startsWith("/qube-appliances/edge/") && path.endsWith("/edit")) return "Edit Edge Theatre";
    if (path === "/qube-appliances/icount-cameras") return "iCount Cameras";
    if (path.startsWith("/qube-appliances/icount-cameras/add")) return "Add iCount Cameras Theatre";
    if (path.startsWith("/qube-appliances/icount-cameras/") && path.endsWith("/edit")) return "Edit iCount Cameras Theatre";

    // Fleet Management
    if (path === "/fleet-management/status") return "Fleet Status";
    if (path === "/fleet-management/tasks") return "Task Management";
    if (path === "/fleet-management/images") return "Image Management";
    if (path.startsWith("/fleet-management/images/") && path.includes("/versions")) return "Manage Versions";
    if (path.startsWith("/fleet-management/images/") && path.endsWith("/configurations")) return "Manage Agent Configurations";
    if (path === "/fleet-management/task/new") return "Create Task";
    if (path.startsWith("/fleet-management/task/") && path.endsWith("/edit")) return "Edit Task";
    if (path.startsWith("/fleet-management/task/") && path.endsWith("/view")) return "Task Details";

    // Screen Pulse
    if (path === "/screen-pulse/dashboard") return "Pulse Dashboard";
    if (path === "/screen-pulse/environment") return "Environment Manager";
    if (path === "/screen-pulse/projection") return "Projection Manager";
    if (path === "/screen-pulse/screens") return "Screen Manager";
    if (path === "/screen-pulse/reports") return "Screen Pulse Reports";

    // Approvals & Conflicts
    if (path === "/approvals-conflicts") return "Approvals & Conflicts";
    if (path === "/approvals-conflicts/company-claims") return "Company Claims";
    if (path === "/approvals-conflicts/partners") return "Partners";
    if (path === "/approvals-conflicts/theatre-deletions") return "Theatre Deletions";

    if (path === "/reports") return "Reports";

    // Location Management
    if (path === "/locations/review") return "Reference Sync Review";
    const locationMatch = /^\/locations\/([a-z-]+)(?:\/(new|[^/]+\/(edit|logs)))?$/.exec(path);
    if (locationMatch) {
      const labels: Record<string, [string, string]> = {
        countries: ["Countries", "Country"], provinces: ["Provinces", "Province"], cities: ["Cities", "City"],
        "metro-areas": ["Metro Areas", "Metro Area"], timezones: ["Timezones", "Timezone"],
      };
      const [plural, singular] = labels[locationMatch[1]] ?? [];
      if (plural) {
        if (locationMatch[2] === "new") return `New ${singular}`;
        if (locationMatch[3] === "edit") return `Edit ${singular}`;
        if (locationMatch[3] === "logs") return `${singular} Logs`;
        return plural;
      }
    }

    return "";
  };
  
  return (
    <header className="sticky top-0 z-30 bg-card border-b border-border">
      <div className="flex items-center justify-between h-16 px-6">
        {isMobile && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setSidebarOpen(true)}
          >
            <MenuIcon size={20} />
          </Button>
        )}
        <div className={cn(
          "text-lg font-semibold",
          isMobile ? "ml-4" : "ml-0"
        )}>
          {getPageTitle()}
        </div>
        <div className="flex items-center space-x-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                id={ARGUS_TOGGLE_ID}
                variant="outline"
                size="sm"
                className={cn("text-xs h-8", argus.open && "bg-purple-50 text-purple-600")}
                onClick={argus.toggle}
                aria-expanded={argus.open}
                aria-controls={argus.open ? ARGUS_PANEL_ID : undefined}
              >
                <ArgusIcon className="mr-1 h-4 w-4" />
                Ask Argus
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {argus.open ? common.close : "Ask Argus"} <kbd className="ml-1 font-sans text-grey-300">{ARGUS_SHORTCUT}</kbd>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  );
};
