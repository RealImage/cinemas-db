import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, AlertTriangle, X, Search } from "lucide-react";
import type { TaskAppliance } from "@/pages/FleetTaskEdit";
import type { FleetTheatre } from "@/data/fleetData";
import { useFleetAppliances, useFleetTheatres } from "@/hooks/api/fleet";
import { common } from "@/i18n/common";

interface AddApplianceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddAppliance: (appliances: TaskAppliance[]) => void;
  existingApplianceIds: string[];
}

type AddMethod = 
  | "applianceSerial" 
  | "hardwareSerial" 
  | "nodeId" 
  | "clusterId" 
  | "theatreId" 
  | "theatreName";

const EMPTY_APPLIANCES: TaskAppliance[] = [];
const EMPTY_THEATRES: FleetTheatre[] = [];

interface SearchResult {
  found: TaskAppliance[];
  alreadyAdded: TaskAppliance[];
  notFound: string[];
}

export const AddApplianceDialog = ({
  open,
  onOpenChange,
  onAddAppliance,
  existingApplianceIds,
}: AddApplianceDialogProps) => {
  const [addMethod, setAddMethod] = useState<AddMethod>("applianceSerial");
  const [inputValue, setInputValue] = useState("");
  const [selectedTheatre, setSelectedTheatre] = useState<string>("");
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [searched, setSearched] = useState(false);

  const appliancesQuery = useFleetAppliances();
  const theatresQuery = useFleetTheatres();
  const availableAppliances = appliancesQuery.data ?? EMPTY_APPLIANCES;
  const theatres = theatresQuery.data ?? EMPTY_THEATRES;
  const uniqueClusters = useMemo(() => [...new Set(availableAppliances.map(a => a.clusterName))], [availableAppliances]);
  const loadError = appliancesQuery.error ?? theatresQuery.error;

  const parseInput = (input: string): string[] => {
    return input
      .split(/[\n,;]+/)
      .map(v => v.trim())
      .filter(v => v.length > 0);
  };

  const handleSearch = () => {
    setSearched(true);
    const results: SearchResult = { found: [], alreadyAdded: [], notFound: [] };

    if (addMethod === "theatreName") {
      // Search by selected theatre name
      if (!selectedTheatre) {
        setSearchResults(results);
        return;
      }
      
      const matchingAppliances = availableAppliances.filter(
        app => app.theatreName.toLowerCase() === selectedTheatre.toLowerCase()
      );
      
      matchingAppliances.forEach(app => {
        if (existingApplianceIds.includes(app.id)) {
          results.alreadyAdded.push(app);
        } else {
          results.found.push(app);
        }
      });

      if (matchingAppliances.length === 0) {
        results.notFound.push(selectedTheatre);
      }
    } else {
      const searchValues = addMethod === "theatreId" 
        ? parseInput(inputValue) 
        : parseInput(inputValue);

      searchValues.forEach(value => {
        let matchingAppliances: TaskAppliance[] = [];
        const valueLower = value.toLowerCase();

        switch (addMethod) {
          case "applianceSerial":
            matchingAppliances = availableAppliances.filter(
              app => app.applianceSerialNumber.toLowerCase() === valueLower
            );
            break;
          case "hardwareSerial":
            matchingAppliances = availableAppliances.filter(
              app => app.hardwareSerialNumber.toLowerCase() === valueLower
            );
            break;
          case "nodeId":
            matchingAppliances = availableAppliances.filter(
              app => app.nodeId.toLowerCase() === valueLower
            );
            break;
          case "clusterId":
            matchingAppliances = availableAppliances.filter(
              app => app.clusterName.toLowerCase() === valueLower
            );
            break;
          case "theatreId": {
            // Match by theatre ID (id, business code or third-party ID)
            const theatre = theatres.find(
              t => t.id === value || t.code?.toLowerCase() === valueLower || t.thirdPartyId?.toLowerCase() === valueLower
            );
            if (theatre) {
              matchingAppliances = availableAppliances.filter(app =>
                app.theatreId ? app.theatreId === theatre.id : app.theatreName.toLowerCase() === theatre.name.toLowerCase()
              );
            }
            break;
          }
        }

        if (matchingAppliances.length > 0) {
          matchingAppliances.forEach(app => {
            // Avoid duplicates in results
            const alreadyInFound = results.found.some(a => a.id === app.id);
            const alreadyInAdded = results.alreadyAdded.some(a => a.id === app.id);
            
            if (!alreadyInFound && !alreadyInAdded) {
              if (existingApplianceIds.includes(app.id)) {
                results.alreadyAdded.push(app);
              } else {
                results.found.push(app);
              }
            }
          });
        } else {
          if (!results.notFound.includes(value)) {
            results.notFound.push(value);
          }
        }
      });
    }

    setSearchResults(results);
  };

  const handleConfirm = () => {
    if (searchResults && searchResults.found.length > 0) {
      onAddAppliance(searchResults.found);
      resetForm();
    }
  };

  const resetForm = () => {
    setAddMethod("applianceSerial");
    setInputValue("");
    setSelectedTheatre("");
    setSearchResults(null);
    setSearched(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
  };

  const methodLabels: Record<AddMethod, { label: string; placeholder: string }> = {
    applianceSerial: { 
      label: "Appliance Serial Numbers", 
      placeholder: "Enter appliance serial numbers (one per line or comma-separated):\nQWA-L28038\nQWA-M12304\nQWA-T23893" 
    },
    hardwareSerial: { 
      label: "Hardware Serial Numbers", 
      placeholder: "Enter hardware serial numbers (one per line or comma-separated):\nHWS-L28038\nHWS-M12304\nHWS-T23893" 
    },
    nodeId: { 
      label: "Node IDs", 
      placeholder: "Enter node IDs (one per line or comma-separated):\nNODE-001\nNODE-002\nNODE-003" 
    },
    clusterId: { 
      label: "Cluster Names", 
      placeholder: `Enter cluster names (one per line or comma-separated):\n${uniqueClusters.slice(0, 3).join('\n')}` 
    },
    theatreId: { 
      label: "Theatre IDs", 
      placeholder: "Enter theatre IDs (one per line or comma-separated):\n1\nT10000\nCCM001" 
    },
    theatreName: { 
      label: "Theatre Name (Search & Select)", 
      placeholder: "" 
    },
  };

  const theatreOptions = useMemo(() => {
    // Get unique theatre names from available appliances
    const applianceTheatres = [...new Set(availableAppliances.map(a => a.theatreName))];
    // Also include every theatre in the database
    const theatreNames = theatres.map(t => t.name);
    const allTheatres = [...new Set([...applianceTheatres, ...theatreNames])];
    return allTheatres.sort();
  }, [availableAppliances, theatres]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Appliances</DialogTitle>
          <DialogDescription>
            Search for appliances to add to this task using various methods.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Method Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Select Method</Label>
            <Select 
              value={addMethod} 
              onValueChange={(v) => {
                setAddMethod(v as AddMethod);
                setSearchResults(null);
                setSearched(false);
                setInputValue("");
                setSelectedTheatre("");
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a method" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(methodLabels) as AddMethod[]).map((method) => (
                  <SelectItem key={method} value={method}>
                    {methodLabels[method].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Input Area */}
          <div className="flex-1 min-h-0">
            {addMethod === "theatreName" ? (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Search Theatre</Label>
                <Command className="border rounded-md">
                  <CommandInput placeholder="Search theatres..." />
                  <CommandList className="max-h-[150px]">
                    <CommandEmpty>No theatre found.</CommandEmpty>
                    <CommandGroup>
                      {theatreOptions.map((theatre) => (
                        <CommandItem
                          key={theatre}
                          value={theatre}
                          onSelect={() => setSelectedTheatre(theatre)}
                        >
                          <Check 
                            className={`mr-2 h-4 w-4 ${
                              selectedTheatre === theatre ? "opacity-100" : "opacity-0"
                            }`} 
                          />
                          {theatre}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
                {selectedTheatre && (
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="text-sm">
                      {selectedTheatre}
                      <button 
                        onClick={() => setSelectedTheatre("")}
                        className="ml-2 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-sm font-medium">{methodLabels[addMethod].label}</Label>
                <Textarea
                  placeholder={methodLabels[addMethod].placeholder}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="min-h-[120px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Enter values separated by commas, semicolons, or new lines
                </p>
              </div>
            )}
          </div>

          {loadError && (
            <p className="text-sm text-red-500" role="alert">
              Could not load appliances: {loadError.message}{" "}
              <button
                type="button"
                className="underline"
                onClick={() => { appliancesQuery.refetch(); theatresQuery.refetch(); }}
              >
                Retry
              </button>
            </p>
          )}

          {/* Search Button */}
          <Button 
            type="button" 
            onClick={handleSearch}
            disabled={appliancesQuery.isPending || theatresQuery.isPending ||
                     (addMethod === "theatreName" && !selectedTheatre) || 
                     (addMethod !== "theatreName" && !inputValue.trim())}
            className="w-full"
          >
            <Search className="h-4 w-4 mr-2" />
            {appliancesQuery.isPending || theatresQuery.isPending ? "Loading appliances…" : "Search"}
          </Button>

          {/* Results Preview */}
          {searched && searchResults && (
            <ScrollArea className="flex-1 min-h-0 max-h-[200px] border rounded-md p-3 bg-muted/30">
              <div className="space-y-3">
                {/* Found */}
                {searchResults.found.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                      <Check className="h-4 w-4" />
                      <span>{searchResults.found.length} appliance(s) found</span>
                    </div>
                    <div className="space-y-1 pl-6">
                      {searchResults.found.slice(0, 5).map(app => (
                        <div key={app.id} className="text-xs text-muted-foreground">
                          {app.applianceSerialNumber} - {app.theatreName}
                        </div>
                      ))}
                      {searchResults.found.length > 5 && (
                        <div className="text-xs text-muted-foreground">
                          ... and {searchResults.found.length - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Already Added */}
                {searchResults.alreadyAdded.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span>{searchResults.alreadyAdded.length} already added (will be skipped)</span>
                    </div>
                    <div className="space-y-1 pl-6">
                      {searchResults.alreadyAdded.slice(0, 3).map(app => (
                        <div key={app.id} className="text-xs text-muted-foreground">
                          {app.applianceSerialNumber} - {app.theatreName}
                        </div>
                      ))}
                      {searchResults.alreadyAdded.length > 3 && (
                        <div className="text-xs text-muted-foreground">
                          ... and {searchResults.alreadyAdded.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Not Found */}
                {searchResults.notFound.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                      <X className="h-4 w-4" />
                      <span>{searchResults.notFound.length} not found</span>
                    </div>
                    <div className="space-y-1 pl-6">
                      {searchResults.notFound.slice(0, 5).map((val, idx) => (
                        <div key={idx} className="text-xs text-muted-foreground">
                          {val}
                        </div>
                      ))}
                      {searchResults.notFound.length > 5 && (
                        <div className="text-xs text-muted-foreground">
                          ... and {searchResults.notFound.length - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* No results */}
                {searchResults.found.length === 0 && 
                 searchResults.alreadyAdded.length === 0 && 
                 searchResults.notFound.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No results. Please enter search criteria and try again.
                  </p>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>{common.cancel}</Button>
          <Button 
            type="button" 
            onClick={handleConfirm}
            disabled={!searchResults || searchResults.found.length === 0}
          >
            Add {searchResults?.found.length || 0} Appliance(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
