export {
  type ChangeLogEntry,
  type RequirementRecord,
  RequirementsDefinitionDocument as RequirementsDocument,
} from "./document-model";

import { RequirementsDefinitionDocument } from "./document-model";

export const parseRequirementsDocument = (source: string): RequirementsDefinitionDocument =>
  new RequirementsDefinitionDocument(source);
