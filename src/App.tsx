
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import Index from "./pages/Index";
import Theatres from "./pages/Theatres";
import FLMFeeds from "./pages/FLMFeeds";
import FlmFeedDetails from "./pages/FlmFeedDetails";
import EditTheatre from "./pages/EditTheatre";
import Chains from "./pages/Chains";
import TDLDevices from "./pages/TDLDevices";
import CredentialsManager from "./pages/CredentialsManager";
import DeviceCredentials from "./pages/DeviceCredentials";
import ScreenDeviceManagement from "./pages/ScreenDeviceManagement";
import EditScreenDeviceList from "./pages/EditScreenDeviceList";
import WireTAPDevices from "./pages/WireTAPDevices";
import AddWireTAPDevice from "./pages/AddWireTAPDevice";
import EditWireTAPDevice from "./pages/EditWireTAPDevice";
import QubeACS from "./pages/QubeACS";
import AddQubeAcsTheatre from "./pages/AddQubeAcsTheatre";
import EditQubeAcsTheatre from "./pages/EditQubeAcsTheatre";
import PulseAppliances from "./pages/PulseAppliances";
import AddPulseTheatre from "./pages/AddPulseTheatre";
import EditPulseTheatre from "./pages/EditPulseTheatre";
import EdgeAppliances from "./pages/EdgeAppliances";
import AddEdgeTheatre from "./pages/AddEdgeTheatre";
import EditEdgeTheatre from "./pages/EditEdgeTheatre";
import IcountCameras from "./pages/IcountCameras";
import AddIcountTheatre from "./pages/AddIcountTheatre";
import EditIcountTheatre from "./pages/EditIcountTheatre";
import TaskManagement from "./pages/TaskManagement";
import AgentConfigurations from "./pages/AgentConfigurations";
import LocationList from "./pages/LocationList";
import LocationForm from "./pages/LocationForm";
import LocationLogs from "./pages/LocationLogs";
import LocationReview from "./pages/LocationReview";
import ImageManagement from "./pages/ImageManagement";
import FleetTaskEdit from "./pages/FleetTaskEdit";
import FleetTaskView from "./pages/FleetTaskView";
import ManageVersions from "./pages/ManageVersions";
import FleetStatus from "./pages/FleetStatus";
import Reports from "./pages/Reports";
import PulseDashboard from "./pages/PulseDashboard";
import ScreenManager from "./pages/ScreenManager";
import ScreenPulseReports from "./pages/ScreenPulseReports";
import EnvironmentManager from "./pages/EnvironmentManager";
import ProjectionManager from "./pages/ProjectionManager";
import ApprovalsConflicts from "./pages/ApprovalsConflicts";
import CompanyClaims from "./pages/CompanyClaims";
import Partners from "./pages/Partners";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <SonnerToaster />
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Index />} />
            <Route path="/theatres" element={<Navigate to="/theatres/list" replace />} />
            <Route path="/theatres/list" element={<Theatres />} />
            <Route path="/theatres/flm-feeds" element={<FLMFeeds />} />
            <Route path="/theatres/flm-feeds/:id" element={<FlmFeedDetails />} />
            <Route path="/theatres/dashboard" element={<Navigate to="/approvals-conflicts" replace />} />
            <Route path="/theatre/:id/edit" element={<EditTheatre />} />
            <Route path="/chains" element={<Chains />} />
            <Route path="/tdl-devices" element={<Navigate to="/theatre-device-management/tdl-devices" replace />} />
            {/* Theatre Device Management */}
            <Route path="/theatre-device-management" element={<Navigate to="/theatre-device-management/screen-devices" replace />} />
            <Route path="/theatre-device-management/screen-devices" element={<ScreenDeviceManagement />} />
            <Route path="/theatre-device-management/screen-devices/:id/edit" element={<EditScreenDeviceList />} />
            <Route path="/theatre-device-management/tdl-devices" element={<TDLDevices />} />
            <Route path="/theatre-device-management/credentials-manager" element={<CredentialsManager />} />
            <Route path="/theatre-device-management/credentials-manager/:id/credentials" element={<DeviceCredentials />} />
            {/* Qube Appliances Routes */}
            <Route path="/qube-appliances" element={<Navigate to="/qube-appliances/wiretap" replace />} />
            <Route path="/qube-appliances/wiretap" element={<WireTAPDevices />} />
            <Route path="/qube-appliances/wiretap/add" element={<AddWireTAPDevice />} />
            <Route path="/qube-appliances/wiretap/:id/edit" element={<EditWireTAPDevice />} />
            <Route path="/qube-appliances/qube-acs" element={<QubeACS />} />
            <Route path="/qube-appliances/qube-acs/add/:lookupId" element={<AddQubeAcsTheatre />} />
            <Route path="/qube-appliances/qube-acs/:id/edit" element={<EditQubeAcsTheatre />} />
            <Route path="/qube-appliances/pulse" element={<PulseAppliances />} />
            <Route path="/qube-appliances/pulse/add/:lookupId" element={<AddPulseTheatre />} />
            <Route path="/qube-appliances/pulse/:id/edit" element={<EditPulseTheatre />} />
            <Route path="/qube-appliances/edge" element={<EdgeAppliances />} />
            <Route path="/qube-appliances/edge/add/:lookupId" element={<AddEdgeTheatre />} />
            <Route path="/qube-appliances/edge/:id/edit" element={<EditEdgeTheatre />} />
            <Route path="/qube-appliances/icount-cameras" element={<IcountCameras />} />
            <Route path="/qube-appliances/icount-cameras/add/:lookupId" element={<AddIcountTheatre />} />
            <Route path="/qube-appliances/icount-cameras/:id/edit" element={<EditIcountTheatre />} />
            {/* Legacy redirects */}
            <Route path="/wiretap-devices" element={<Navigate to="/qube-appliances/wiretap" replace />} />
            <Route path="/wiretap-devices/add" element={<Navigate to="/qube-appliances/wiretap/add" replace />} />
            <Route path="/wiretap-devices/:id/edit" element={<EditWireTAPDevice />} />
            {/* Fleet Management Routes */}
            <Route path="/fleet-management" element={<Navigate to="/fleet-management/status" replace />} />
            <Route path="/fleet-management/status" element={<FleetStatus />} />
            <Route path="/fleet-management/tasks" element={<TaskManagement />} />
            <Route path="/fleet-management/tasks" element={<TaskManagement />} />
            <Route path="/fleet-management/images" element={<ImageManagement />} />
            <Route path="/fleet-management/images/:imageId/versions" element={<ManageVersions />} />
            <Route path="/fleet-management/images/:id/configurations" element={<AgentConfigurations />} />
            <Route path="/fleet-management/task/new" element={<FleetTaskEdit />} />
            <Route path="/fleet-management/task/:id/edit" element={<FleetTaskEdit />} />
            <Route path="/fleet-management/task/:id/view" element={<FleetTaskView />} />
            <Route path="/reports" element={<Reports />} />
            {/* Location Management */}
            <Route path="/locations" element={<Navigate to="/locations/countries" replace />} />
            <Route path="/locations/review" element={<LocationReview />} />
            <Route path="/locations/:entity" element={<LocationList />} />
            <Route path="/locations/:entity/new" element={<LocationForm />} />
            <Route path="/locations/:entity/:id/edit" element={<LocationForm />} />
            <Route path="/locations/:entity/:id/logs" element={<LocationLogs />} />
            {/* Screen Pulse Routes */}
            <Route path="/screen-pulse" element={<Navigate to="/screen-pulse/dashboard" replace />} />
            <Route path="/screen-pulse/dashboard" element={<PulseDashboard />} />
            <Route path="/screen-pulse/environment" element={<EnvironmentManager />} />
            <Route path="/screen-pulse/projection" element={<ProjectionManager />} />
            <Route path="/screen-pulse/screens" element={<ScreenManager />} />
            <Route path="/screen-pulse/reports" element={<ScreenPulseReports />} />
            <Route path="/approvals-conflicts" element={<ApprovalsConflicts />} />
            <Route path="/approvals-conflicts/company-claims" element={<CompanyClaims />} />
            <Route path="/approvals-conflicts/partners" element={<Partners />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
