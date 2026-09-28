import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Search, AlertTriangle } from "lucide-react";
import { searchWireTAPDevice } from "@/hooks/api/theatres";
import { WireTAPDevice } from "@/types/wireTAP";
import { common } from "@/i18n/common";

interface AddWireTAPToTheatreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theatreId: string;
  onConfirm: (device: WireTAPDevice) => void;
}

type SearchType = "applicationSerialNumber" | "hardwareSerialNumber" | "hostName";

const searchTypeLabels: Record<SearchType, string> = {
  applicationSerialNumber: "Appliance Serial Number",
  hardwareSerialNumber: "Hardware Serial Number",
  hostName: "Host Name",
};

export function AddWireTAPToTheatreDialog({
  open,
  onOpenChange,
  theatreId,
  onConfirm,
}: AddWireTAPToTheatreDialogProps) {
  const [searchType, setSearchType] = useState<SearchType>("applicationSerialNumber");
  const [searchText, setSearchText] = useState("");
  const [searchResult, setSearchResult] = useState<WireTAPDevice | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [autoConfig, setAutoConfig] = useState(false);

  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchText.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      setSearchResult(await searchWireTAPDevice(searchType, searchText.trim()));
    } catch (err) {
      setSearchResult(null);
      setSearchError((err as Error).message);
    } finally {
      setSearching(false);
      setHasSearched(true);
    }
  };

  const handleConfirm = () => {
    if (searchResult) {
      onConfirm(searchResult);
      handleClose();
    }
  };

  const handleClose = () => {
    setSearchText("");
    setSearchResult(null);
    setHasSearched(false);
    setSearchError(null);
    setAutoConfig(false);
    onOpenChange(false);
  };

  const isMappedToOtherTheatre =
    searchResult?.mappingStatus === "Mapped" &&
    searchResult?.pullOutStatus !== "Pulled Out" &&
    searchResult?.theatreId !== theatreId;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add WireTAP</DialogTitle>
          <DialogDescription>
            Search for a WireTAP device to add to this theatre
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search Controls */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Search By</Label>
              <Select
                value={searchType}
                onValueChange={(value) => setSearchType(value as SearchType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="applicationSerialNumber">
                    Appliance Serial Number
                  </SelectItem>
                  <SelectItem value="hardwareSerialNumber">
                    Hardware Serial Number
                  </SelectItem>
                  <SelectItem value="hostName">Host Name</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder={`Enter ${searchTypeLabels[searchType]}`}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={!searchText.trim() || searching}>
                <Search className="h-4 w-4 mr-1" />
                {searching ? "Searching…" : "Search"}
              </Button>
            </div>
          </div>

          {/* Search Results */}
          {hasSearched && (
            <div className="border-t pt-4 space-y-4">
              {searchResult ? (
                <>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <Label className="text-muted-foreground text-xs">
                        Appliance Serial Number
                      </Label>
                      <p className="font-medium">{searchResult.applicationSerialNumber}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">
                        Hardware Serial Number
                      </Label>
                      <p className="font-medium">{searchResult.hardwareSerialNumber}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">
                        Host Name / Node ID
                      </Label>
                      <p className="font-medium">{searchResult.hostName}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">
                        Appliance Type
                      </Label>
                      <p className="font-medium">{searchResult.wireTapApplianceType}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">
                        Theatre Network Interface
                      </Label>
                      <p className="font-medium">{searchResult.connectivityType}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">
                        Mapping Status
                      </Label>
                      <p className="font-medium">
                        {searchResult.mappingStatus === "Mapped" ? "Yes" : "No"}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-muted-foreground text-xs">
                        Theatre Mapped
                      </Label>
                      <p className="font-medium">
                        {searchResult.mappingStatus === "Mapped"
                          ? `${searchResult.theatreName}, ${searchResult.theatreAddress}`
                          : "--"}
                      </p>
                    </div>
                  </div>

                  {isMappedToOtherTheatre && (
                    <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-800">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        WireTAP is mapped to another theatre. Pull out the WireTAP before mapping.
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              ) : (
                <p className={`text-center py-4 ${searchError ? "text-red-500" : "text-muted-foreground"}`}>
                  {searchError ? `Search failed: ${searchError}` : "No device found matching the search criteria."}
                </p>
              )}
            </div>
          )}
        </div>

        {searchResult && !isMappedToOtherTheatre && (
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="auto-config"
              checked={autoConfig}
              onCheckedChange={(checked) => setAutoConfig(checked === true)}
            />
            <label
              htmlFor="auto-config"
              className="text-sm font-medium leading-none cursor-pointer"
            >
              Auto-configure WireTAP setup for this Theatre.
            </label>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>{common.cancel}</Button>
          <Button
            onClick={handleConfirm}
            disabled={!searchResult || isMappedToOtherTheatre}
          >
            {common.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
