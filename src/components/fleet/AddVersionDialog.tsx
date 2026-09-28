import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

import type { ImageItem } from "@/data/fleetData";
import type { AddVersionInput } from "@/hooks/api/fleet";
import { common } from "@/i18n/common";

interface AddVersionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  image: ImageItem | null;
  onSubmit: (data: AddVersionInput) => Promise<unknown>;
}

export function AddVersionDialog({
  open,
  onOpenChange,
  image,
  onSubmit,
}: AddVersionDialogProps) {
  const [formData, setFormData] = useState({
    version: "",
    imageUrl: "",
    releaseNotes: "",
    changelog: "",
  });

  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!formData.version.trim()) {
      toast.error("Please enter a version number");
      return;
    }
    if (!image) return;

    setSaving(true);
    try {
      await onSubmit({
        imageId: image.id,
        version: formData.version.trim(),
        imageUrl: formData.imageUrl,
        releaseNotes: formData.releaseNotes,
        internalNotes: formData.changelog,
      });
      toast.success(`Version ${formData.version.trim()} added for ${image.agentOsName}`);
      onOpenChange(false);
      setFormData({ version: "", imageUrl: "", releaseNotes: "", changelog: "" });
    } catch (err) {
      toast.error(`Could not add version: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setFormData({ version: "", imageUrl: "", releaseNotes: "", changelog: "" });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Version</DialogTitle>
          <DialogDescription>
            Add a new version for {image?.agentOsName} ({image?.provider})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="version">Version Number</Label>
            <Input
              id="version"
              placeholder="e.g., v4.2.0"
              value={formData.version}
              onChange={(e) => setFormData({ ...formData, version: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="imageUrl">Image URL / Link</Label>
            <Input
              id="imageUrl"
              placeholder="e.g., s3://bucket-name/path or https://sharepoint.com/..."
              value={formData.imageUrl}
              onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="releaseNotes">Release Notes</Label>
            <Textarea
              id="releaseNotes"
              placeholder="Enter release notes..."
              value={formData.releaseNotes}
              onChange={(e) => setFormData({ ...formData, releaseNotes: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="changelog">Internal Reference Notes</Label>
            <Textarea
              id="changelog"
              placeholder="Enter changelog details..."
              value={formData.changelog}
              onChange={(e) => setFormData({ ...formData, changelog: e.target.value })}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>{common.cancel}</Button>
          <Button onClick={handleSubmit} loading={saving}>{common.save}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
