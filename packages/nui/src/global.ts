import { nui } from "./nui/nui";
import { NuiError } from "./nui/nui-error";

// Exposes the SDK on `window.bytium.nui` for NUIs loaded as a plain <script>, mirroring the ESM `nui` export.
const scope = window as unknown as { bytium?: Record<string, unknown> };

scope.bytium = scope.bytium || {};
scope.bytium.nui = { ...nui, NuiError };
