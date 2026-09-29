import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { XIcon, Home, LogOut, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { NavItem } from "./NavItem";
import { NavItemWithSubmenu } from "./NavItemWithSubmenu";
import { Separator } from "@/components/ui/separator";
import { Building2, LinkIcon, Monitor, Building, FileText, LayoutDashboard, List, Users, Bell, Settings, Map, ClipboardList, HardDrive, ClipboardCheck, Activity, Server, Radio, Zap, Cpu, MonitorSmartphone, ShieldCheck, Camera, KeyRound, Globe, MapPinned, Clock, GitCompare } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
export const SidebarNav = ({
  sidebarOpen,
  setSidebarOpen,
  onCollapsedChange
}: {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  onCollapsedChange?: (collapsed: boolean) => void;
}) => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const toggleCollapsed = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    onCollapsedChange?.(newCollapsed);
  };

  // Mock user data (replace with actual user context when available)
  const userData = {
    name: "John Smith",
    company: "Qube Cinema Inc.",
    role: "Administrator"
  };
  const navItems = [{
    icon: <LayoutDashboard size={20} />,
    label: "Dashboard",
    path: "/"
  }];
  const theatresSubItems = [{
    label: "Theatre List",
    path: "/theatres/list",
    icon: List
  }, {
    label: "FLM Feeds",
    path: "/theatres/flm-feeds",
    icon: FileText
  }];
  const chainsNavItems = [{
    icon: <LinkIcon size={20} />,
    label: "Chains",
    path: "/chains"
  }];
  const fleetManagementSubItems = [{
    label: "Fleet Status",
    path: "/fleet-management/status",
    icon: LayoutDashboard
  }, {
    label: "Task Management",
    path: "/fleet-management/tasks",
    icon: ClipboardList
  }, {
    label: "Image Management",
    path: "/fleet-management/images",
    icon: HardDrive
  }];
  const qubeAppliancesSubItems = [{
    label: "WireTAP",
    path: "/qube-appliances/wiretap",
    icon: Radio
  }, {
    label: "Qube ACS",
    path: "/qube-appliances/qube-acs",
    icon: Cpu
  }, {
    label: "Pulse",
    path: "/qube-appliances/pulse",
    icon: Activity
  }, {
    label: "Edge",
    path: "/qube-appliances/edge",
    icon: Zap
  }, {
    label: "iCount Cameras",
    path: "/qube-appliances/icount-cameras",
    icon: Camera
  }];
  const theatreDeviceManagementSubItems = [{
    label: "Screen Device Management",
    path: "/theatre-device-management/screen-devices",
    icon: MonitorSmartphone
  }, {
    label: "TDL Devices",
    path: "/theatre-device-management/tdl-devices",
    icon: ShieldCheck
  }, {
    label: "Credentials Manager",
    path: "/theatre-device-management/credentials-manager",
    icon: KeyRound
  }];
  const screenPulseSubItems = [{
    label: "Pulse Dashboard",
    path: "/screen-pulse/dashboard",
    icon: LayoutDashboard
  }, {
    label: "Environment Manager",
    path: "/screen-pulse/environment",
    icon: Settings
  }, {
    label: "Projection Manager",
    path: "/screen-pulse/projection",
    icon: Monitor
  }, {
    label: "Screen Manager",
    path: "/screen-pulse/screens",
    icon: Monitor
  }, {
    label: "Reports",
    path: "/screen-pulse/reports",
    icon: FileText
  }];
  const locationSubItems = [{
    label: "Countries",
    path: "/locations/countries",
    icon: Globe
  }, {
    label: "Provinces",
    path: "/locations/provinces",
    icon: Map
  }, {
    label: "Cities",
    path: "/locations/cities",
    icon: Building2
  }, {
    label: "Metro Areas",
    path: "/locations/metro-areas",
    icon: MapPinned
  }, {
    label: "Timezones",
    path: "/locations/timezones",
    icon: Clock
  }, {
    label: "Review",
    path: "/locations/review",
    icon: GitCompare
  }];
  const additionalNavItems = [{
    icon: <ClipboardCheck size={20} />,
    label: "Approvals & Conflicts",
    path: "/approvals-conflicts",
    disabled: false
  }];
  const bottomNavItems = [{
    icon: <Building size={20} />,
    label: "Companies",
    path: "#",
    disabled: true
  }, {
    icon: <FileText size={20} />,
    label: "Reports",
    path: "/reports",
    disabled: false
  }, {
    icon: <Users size={20} />,
    label: "User Management",
    path: "#",
    disabled: true
  }, {
    icon: <Bell size={20} />,
    label: "Notification Settings",
    path: "#",
    disabled: true
  }, {
    icon: <Settings size={20} />,
    label: "Role Management",
    path: "#",
    disabled: true
  }];

  // Modified footer links with Terms of Service and Privacy Policy combined
  const footerLinks = [{
    label: "Terms of Service | Privacy Policy",
    elements: [{
      label: "Terms of Service",
      path: "https://www.qubecinema.com/terms-use"
    }, {
      label: "Privacy Policy",
      path: "https://www.qubewire.com/privacypolicy"
    }]
  }, {
    icon: <ExternalLink size={16} />,
    label: "About Qube Wire",
    path: "https://www.qubewire.com/about-us",
    external: true
  }, {
    icon: <LogOut size={16} />,
    label: "Sign Out",
    path: "/logout",
    external: false
  }];
  const isActive = (path: string) => {
    return location.pathname === path;
  };
  return <motion.aside className={`fixed inset-y-0 left-0 z-50 bg-card border-r border-border py-2 flex flex-col transition-all duration-300 ${isCollapsed ? 'w-16 px-2' : 'w-64 px-3'}`} initial={isMobile ? {
    x: "-100%"
  } : false} animate={isMobile && sidebarOpen ? {
    x: 0
  } : false}>
      <div className="flex items-center justify-between mb-3">
        {!isCollapsed ? <Link to="/" className="flex items-center space-x-2">
            <Home className="h-6 w-6 text-primary" />
            <span className="text-xl font-semibold text-grey-800">CinemaDB</span>
          </Link> : <Link to="/" className="flex justify-center w-full">
            <Home className="h-6 w-6 text-primary" />
          </Link>}
        {isMobile && <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
            <XIcon size={20} />
          </Button>}
      </div>

      {/* Collapse/Expand button */}
      {!isMobile && <div className="mb-4">
          <Button variant="ghost" size="icon" onClick={toggleCollapsed} className="w-full flex justify-center">
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </Button>
        </div>}
      
      <nav className="space-y-1 flex-1 overflow-auto">
        {navItems.map((item, i) => <NavItem key={i} icon={item.icon} label={item.label} path={item.path} isActive={isActive(item.path)} collapsed={isCollapsed} />)}

        {/* Theatres with submenu */}
        <NavItemWithSubmenu icon={Building2} label="Theatres" basePath="/theatres" subItems={theatresSubItems} isCollapsed={isCollapsed} />

        {chainsNavItems.map((item, i) => <NavItem key={`chain-${i}`} icon={item.icon} label={item.label} path={item.path} isActive={isActive(item.path)} collapsed={isCollapsed} />)}
        
        
        {/* Devices Master with submenu */}
        <NavItemWithSubmenu icon={Monitor} label="Devices Master" basePath="/theatre-device-management" subItems={theatreDeviceManagementSubItems} isCollapsed={isCollapsed} />

        {/* Qube Appliances with submenu */}
        <NavItemWithSubmenu icon={Server} label="Qube Appliances" basePath="/qube-appliances" subItems={qubeAppliancesSubItems} isCollapsed={isCollapsed} />

        {/* Fleet Management with submenu */}
        <NavItemWithSubmenu icon={Settings} label="Fleet Management" basePath="/fleet-management" subItems={fleetManagementSubItems} isCollapsed={isCollapsed} />
        
        {/* Screen Pulse with submenu */}
        <NavItemWithSubmenu icon={Activity} label="Screen Pulse" basePath="/screen-pulse" subItems={screenPulseSubItems} isCollapsed={isCollapsed} />
        {/* Approvals & Conflicts */}
        {additionalNavItems.map((item, i) => <NavItem key={`additional-${i}`} icon={item.icon} label={item.label} path={item.path} isActive={isActive(item.path)} disabled={item.disabled} collapsed={isCollapsed} />)}
        
        {bottomNavItems.slice(0, 2).map((item, i) => <NavItem key={`bottom-${i}`} icon={item.icon} label={item.label} path={item.path} isActive={isActive(item.path)} disabled={item.disabled} collapsed={isCollapsed} />)}

        {/* Location Management with submenu */}
        <NavItemWithSubmenu icon={Map} label="Location Management" basePath="/locations" subItems={locationSubItems} isCollapsed={isCollapsed} />

        {bottomNavItems.slice(2).map((item, i) => <NavItem key={`bottom-${i + 2}`} icon={item.icon} label={item.label} path={item.path} isActive={isActive(item.path)} disabled={item.disabled} collapsed={isCollapsed} />)}
      </nav>
      
      {/* Footer links with combined Terms/Privacy */}
      <div className="mt-auto pt-2">
        <Separator className="mb-2" />
        
        {/* User information */}
        {!isCollapsed && <div className="mb-2 px-2 flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-sm">{userData.name}</h3>
              <p className="text-xs text-muted-foreground">{userData.company}</p>
              <p className="text-xs text-muted-foreground">{userData.role}</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Settings size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <a href="https://studio.firebase.google.com/studio-59580137" target="_blank" rel="noopener noreferrer">
                    Company Profile
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="https://studio.firebase.google.com/studio-59580137" target="_blank" rel="noopener noreferrer">
                    Manage Users
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>}
        <div className="space-y-2">
          {!isCollapsed ? <>
              {/* Terms and Privacy combined with separator */}
              <div className="flex items-center px-2 text-xs text-muted-foreground">
                <ExternalLink size={16} className="mr-2" />
                <a href="https://www.qubecinema.com/terms-use" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Terms of Service</a>
                <span className="mx-1">|</span>
                <a href="https://www.qubewire.com/privacypolicy" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Privacy Policy</a>
              </div>
              
              {/* About Qube Wire and Sign Out */}
              {footerLinks.slice(1).map((link, i) => {})}
            </> : (/* Collapsed footer - only icons with tooltips */
        <>
              {footerLinks.slice(1).map((link, i) => <NavItem key={i} icon={link.icon} label={link.label} path={link.path} isActive={false} external={link.external} className="text-xs py-1.5" collapsed={true} />)}
            </>)}
        </div>
      </div>
    </motion.aside>;
};