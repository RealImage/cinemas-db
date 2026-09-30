import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Lock } from "lucide-react";
import { CredentialFieldDef, roleDescription } from "@/data/credentialsManagerData";

/** Role codes as tags, with the role's description on hover. */
export const RoleBadges = ({ roles, variant = "secondary" }: { roles: string[]; variant?: "secondary" | "product" }) =>
  roles.length === 0 ? null : (
    <div className="flex flex-wrap gap-1">
      {roles.map((r) => {
        const description = roleDescription(r);
        const badge = <Badge key={r} variant={variant} className="font-normal">{r}</Badge>;
        return description ? (
          <Tooltip key={r}>
            <TooltipTrigger asChild><span aria-label={`${r}: ${description}`}>{badge}</span></TooltipTrigger>
            <TooltipContent>{description}</TooltipContent>
          </Tooltip>
        ) : badge;
      })}
    </div>
  );

/** The credentials format: each field with its value type (and whether it's optional), and a lock when it's masked. */
export const CredentialFieldsList = ({ fields }: { fields: CredentialFieldDef[] }) =>
  fields.length === 0 ? (
    <span className="text-sm font-normal text-muted-foreground">No fields defined</span>
  ) : (
    <div className="flex flex-wrap gap-1">
      {fields.map((f) => (
        <Badge key={f.key} variant="outline" className="gap-1 font-normal">
          {f.masked && <Lock className="h-3 w-3 text-muted-foreground" aria-label="Masked" />}
          {f.name}
          <span className="text-muted-foreground">
            {f.valueType === "numeric" ? "Numeric" : "String"}{!f.mandatory && ", optional"}
          </span>
        </Badge>
      ))}
    </div>
  );
