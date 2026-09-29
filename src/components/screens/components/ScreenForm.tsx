
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Screen } from "@/types";
import { toast } from "sonner";
import { GeneralTab } from "../tabs/GeneralTab";
import { DetailsTab } from "../tabs/DetailsTab";
import { DimensionsTab } from "../tabs/DimensionsTab";
import { ProjectionTab } from "../tabs/ProjectionTab";
import { SoundTab } from "../tabs/SoundTab";
import { DevicesTab } from "../tabs/DevicesTab";
import { SuitesTab } from "../tabs/SuitesTab";
import { TemporaryClosuresTab } from "../tabs/TemporaryClosuresTab";

interface ScreenFormProps {
  formData: Partial<Screen>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Screen>>>;
  thirdPartyDomain: string;
  setThirdPartyDomain: React.Dispatch<React.SetStateAction<string>>;
  thirdPartyValue: string;
  setThirdPartyValue: React.Dispatch<React.SetStateAction<string>>;
  onSubmit: (e: React.FormEvent) => void;
  isEditing: boolean;
  errors: { number?: string; name?: string; imaxIntegrationType?: string; statusReason?: string };
}

export const ScreenForm = ({
  formData,
  setFormData,
  thirdPartyDomain,
  setThirdPartyDomain,
  thirdPartyValue,
  setThirdPartyValue,
  onSubmit,
  isEditing,
  errors,
}: ScreenFormProps) => {
  return (
    <form onSubmit={onSubmit} className="flex flex-col h-full overflow-hidden">
      <Tabs defaultValue="general" className="w-full flex-1 flex flex-col overflow-hidden">
        <div className="px-6">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="general">General Information</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="dimensions">Dimensions</TabsTrigger>
            <TabsTrigger value="projection">Projection</TabsTrigger>
            <TabsTrigger value="sound">Sound</TabsTrigger>
            <TabsTrigger value="devices">Devices</TabsTrigger>
            <TabsTrigger value="suites">Suites</TabsTrigger>
            <TabsTrigger value="closures">Temporary Closures</TabsTrigger>
          </TabsList>
        </div>
        
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <TabsContent value="general" className="mt-0 h-full">
            <GeneralTab 
              formData={formData}
              setFormData={setFormData}
              thirdPartyDomain={thirdPartyDomain}
              setThirdPartyDomain={setThirdPartyDomain}
              thirdPartyValue={thirdPartyValue}
              setThirdPartyValue={setThirdPartyValue}
              errors={errors}
            />
          </TabsContent>
          
          <TabsContent value="details" className="mt-0 h-full">
            <DetailsTab 
              formData={formData}
              setFormData={setFormData}
            />
          </TabsContent>
          
          <TabsContent value="dimensions" className="mt-0 h-full">
            <DimensionsTab 
              formData={formData}
              setFormData={setFormData}
            />
          </TabsContent>
          
          <TabsContent value="projection" className="mt-0 h-full">
            <ProjectionTab 
              formData={formData}
              setFormData={setFormData}
            />
          </TabsContent>
          
          <TabsContent value="sound" className="mt-0 h-full">
            <SoundTab 
              formData={formData}
              setFormData={setFormData}
            />
          </TabsContent>
          
          <TabsContent value="devices" className="mt-0 h-full">
            <DevicesTab 
              formData={formData}
              setFormData={setFormData}
            />
          </TabsContent>
          
          <TabsContent value="suites" className="mt-0 h-full">
            <SuitesTab 
              formData={formData}
              setFormData={setFormData}
            />
          </TabsContent>
          
          <TabsContent value="closures" className="mt-0 h-full">
            <TemporaryClosuresTab 
              formData={formData}
              setFormData={setFormData}
            />
          </TabsContent>
        </div>
      </Tabs>
      
      <div className="px-6 py-4 border-t">
        <Button type="submit" variant="default">
          {isEditing ? "Update Screen" : "Create Screen"}
        </Button>
      </div>
    </form>
  );
};
