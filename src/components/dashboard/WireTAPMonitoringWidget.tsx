
import { useMemo } from "react";
import { formatDate } from "@/lib/dateUtils";
import { ExternalLink, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useWireTAPDevices } from "@/hooks/api/wiretap";
import { isDeviceOfflineTooLong } from "@/components/wiretap/StatusIcons";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/dashboard/DashboardCard";

export const WireTAPMonitoringWidget = () => {
  const { data: devices = [] } = useWireTAPDevices();

  // Active devices that have been offline for more than 24 hours
  const offlineDevices = useMemo(
    () => devices.filter((device) => device.activationStatus === "Active" && isDeviceOfflineTooLong(device.updatedAt)),
    [devices],
  );

  return (
    <DashboardCard 
      title="WireTAP Monitoring" 
      description={`${offlineDevices.length} devices require attention`}
    >
      <div className="space-y-4">
        {offlineDevices.length > 0 ? (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center text-red-500">
                <AlertCircle className="h-4 w-4 mr-2" />
                <span className="text-sm font-medium">Devices Offline &gt; 24hrs</span>
              </div>
              <span className="text-sm font-bold">{offlineDevices.length}</span>
            </div>
            
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
              {offlineDevices.slice(0, 5).map((device) => (
                <div key={device.id} className="p-2 border rounded-md bg-red-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium">{device.hostName}</p>
                      <p className="text-xs text-muted-foreground">
                        {device.theatreName
                          ? <TheatreNameWithInfo name={device.theatreName} theatreRef={device.theatreId || device.theatreName} nameClassName="" />
                          : "Unmapped"}
                      </p>
                    </div>
                    <div className="text-xs text-right">
                      <p className="text-red-600 font-medium">Last seen:</p>
                      <p>{formatDate(device.updatedAt)}</p>
                    </div>
                  </div>
                </div>
              ))}
              
              {offlineDevices.length > 5 && (
                <p className="text-xs text-center text-muted-foreground mt-2">
                  and {offlineDevices.length - 5} more...
                </p>
              )}
            </div>
            
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link to="/wiretap-devices">
                View All Devices <ExternalLink className="h-3 w-3 ml-2" />
              </Link>
            </Button>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-8">
            <div className="text-green-500 mb-2">
              <CheckCircle className="h-16 w-16 opacity-80" />
            </div>
            <p className="text-center text-sm text-muted-foreground">
              All WireTAP devices are online and operating normally.
            </p>
          </div>
        )}
      </div>
    </DashboardCard>
  );
};

// Add the missing CheckCircle icon import
import { CheckCircle } from "lucide-react";
import { TheatreNameWithInfo } from "@/components/theatres/TheatreInfo";
