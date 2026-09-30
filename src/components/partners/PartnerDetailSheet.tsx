import { useState, useMemo } from "react";
import { PartnerRequest } from "@/data/partnersData";
import { useAddPartnerRegion, useDeletePartnerRegion, usePartnerRegionOptions, usePartnerRegions, useReviewPartnerRequest } from "@/hooks/api/approvals";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TheatreNameWithInfo } from "@/components/theatres/TheatreInfo";

interface PartnerDetailSheetProps {
  partner: PartnerRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-sm">{value}</span>
  </div>
);

type ParameterType = "Location" | "Chain" | "Theatre";

export const PartnerDetailSheet = ({ partner, open, onOpenChange }: PartnerDetailSheetProps) => {
  const regionsQuery = usePartnerRegions(open ? partner?.id : undefined);
  const regions = regionsQuery.data ?? [];
  const optionsQuery = usePartnerRegionOptions();
  const addRegion = useAddPartnerRegion(partner?.id ?? "");
  const deleteRegion = useDeletePartnerRegion(partner?.id ?? "");
  const review = useReviewPartnerRequest();
  const [parameterType, setParameterType] = useState<ParameterType>("Location");
  const [searchValue, setSearchValue] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);

  const filteredOptions = useMemo(() => {
    const options = optionsQuery.data;
    const list = !options ? [] : parameterType === "Location" ? options.locations : parameterType === "Chain" ? options.chains : options.theatres;
    return list
      .filter((opt) => opt.toLowerCase().includes(searchValue.toLowerCase()))
      .slice(0, 50);
  }, [optionsQuery.data, parameterType, searchValue]);

  if (!partner) return null;

  const decide = async (decision: "accept" | "reject") => {
    try {
      await review.mutateAsync({ id: partner.id, decision });
    } catch (err) {
      toast.error(`Could not ${decision} partner request: ${(err as Error).message}`);
      return;
    }
    if (decision === "accept") toast.success(`Partner request from "${partner.company}" has been accepted.`);
    else toast.error(`Partner request from "${partner.company}" has been rejected.`);
    onOpenChange(false);
  };
  const handleAccept = () => decide("accept");
  const handleReject = () => decide("reject");

  const handleAdd = async () => {
    if (!searchValue.trim()) {
      toast.error("Please enter a value");
      return;
    }
    try {
      await addRegion.mutateAsync({ parameterType, value: searchValue.trim() });
      setSearchValue("");
      toast.success("Operations region added");
    } catch (err) {
      toast.error(`Could not add operations region: ${(err as Error).message}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRegion.mutateAsync(id);
      toast.success("Operations region removed");
    } catch (err) {
      toast.error(`Could not remove operations region: ${(err as Error).message}`);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Partner Request</SheetTitle>
          <SheetDescription>Review the partner details below.</SheetDescription>
        </SheetHeader>

        {/* Section 1: Partner Details */}
        <div className="py-4 space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Partner Details</h3>
           <div className="grid grid-cols-2 gap-3">
              <DetailRow label="Name" value={partner.name} />
              <DetailRow label="Company Legal Name" value={partner.companyLegalName} />
              <DetailRow label="Company Role" value={partner.companyRole} />
              <DetailRow label="Street Address" value={partner.streetAddress} />
              <DetailRow label="Location" value={`${partner.city}, ${partner.state}, ${partner.country}`} />
              <DetailRow label="Company Website" value={partner.companyWebsite} />
              <DetailRow label="Company Phone" value={partner.companyPhone} />
            </div>
        </div>

        <Separator />

        {/* Section 2: Partner Operations Region */}
        <div className="py-4 space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Partner Operations Region</h3>

          <div className="flex items-end gap-2">
            <div className="space-y-1 flex-shrink-0">
              <span className="text-xs text-muted-foreground">Parameter Type</span>
              <Select value={parameterType} onValueChange={(v) => { setParameterType(v as ParameterType); setSearchValue(""); }}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Location">Location</SelectItem>
                  <SelectItem value="Chain">Chain</SelectItem>
                  <SelectItem value="Theatre">Theatre</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 flex-1">
              <span className="text-xs text-muted-foreground">Value</span>
              {/* Non-modal: the trigger is the search input, so focus must stay in it while typing */}
              <Popover modal={false} open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <Input
                    placeholder={`Search ${parameterType.toLowerCase()}...`}
                    value={searchValue}
                    onChange={(e) => { setSearchValue(e.target.value); setPopoverOpen(true); }}
                    onFocus={() => setPopoverOpen(true)}
                  />
                </PopoverTrigger>
                <PopoverContent
                  className="p-0 w-[--radix-popover-trigger-width]"
                  align="start"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                  // Keep wheel/touch scrolling from reaching the sheet's scroll lock, so the list scrolls
                  onWheel={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                >
                  <Command>
                    <CommandList>
                      <CommandEmpty>No results found.</CommandEmpty>
                      <CommandGroup>
                        {filteredOptions.map((option) => (
                          <CommandItem
                            key={option}
                            value={option}
                            onSelect={(val) => {
                              setSearchValue(val);
                              setPopoverOpen(false);
                            }}
                          >
                            {option}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <Button onClick={handleAdd} size="sm" className="flex-shrink-0" disabled={addRegion.isPending}>
              Add
            </Button>
          </div>

          {regionsQuery.isPending && <p className="text-sm text-muted-foreground">Loading operations regions…</p>}
          {regionsQuery.isError && (
            <p className="text-sm text-red-500">
              Could not load operations regions: {regionsQuery.error.message}{" "}
              <Button variant="link" className="h-auto p-0" onClick={() => regionsQuery.refetch()}>Retry</Button>
            </p>
          )}
          {regions.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parameter Type</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regions.map((region) => (
                    <TableRow key={region.id}>
                      <TableCell className="text-sm">{region.parameterType}</TableCell>
                      <TableCell className="text-sm">
                        {region.parameterType === "Theatre" && region.value
                          ? <TheatreNameWithInfo name={region.value} theatreRef={region.value} nameClassName="" />
                          : region.value}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(region.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <SheetFooter className="flex flex-row gap-2 sm:justify-start pt-4">
          <Button onClick={handleAccept} className="flex-1" disabled={review.isPending}>Accept</Button>
          <Button variant="destructive" onClick={handleReject} className="flex-1" disabled={review.isPending}>Reject</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
