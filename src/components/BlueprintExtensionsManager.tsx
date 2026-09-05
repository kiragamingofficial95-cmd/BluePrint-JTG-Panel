import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Boxes,
  Settings,
  RefreshCw,
  Trash2,
  Power,
  Plus,
  AlertCircle,
  CheckCircle2,
  MoreVertical,
  Shield,
  ExternalLink,
  Code,
  Sparkles,
  Info,
  Check,
  X,
  Stethoscope,
  Key,
  Layers,
  ChevronRight,
  UploadCloud,
  FileCode,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: { name: string; url?: string };
  icon?: string;
  compatibility?: { jtg_panel: string; blueprint: string };
  permissions?: string[];
  configSchema?: {
    fields: Array<{
      key: string;
      label: string;
      type: "string" | "number" | "boolean" | "select" | "textarea" | "password";
      default?: any;
      options?: Array<{ label: string; value: any }>;
      description?: string;
      required?: boolean;
      min?: number;
      max?: number;
    }>;
  };
}

interface ExtensionItem {
  id?: string;
  manifest?: ExtensionManifest;
  name?: string;
  description?: string;
  version?: string;
  status: "active" | "disabled" | "error" | "incompatible";
  enabled: boolean;
  installedAt?: string;
  grantedPermissions?: string[];
  isCore?: boolean;
  author?: { name: string; url?: string };
  errorMessage?: string;
}

export function BlueprintExtensionsManager() {
  const [blueprintCore, setBlueprintCore] = useState<any>(null);
  const [extensions, setExtensions] = useState<ExtensionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Add Extension Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [extensionKey, setExtensionKey] = useState("");
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [keyPreview, setKeyPreview] = useState<any | null>(null);
  const [installTab, setInstallTab] = useState<"key" | "upload">("key");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Configure Modal
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [selectedExt, setSelectedExt] = useState<ExtensionItem | null>(null);
  const [extConfig, setExtConfig] = useState<Record<string, any>>({});
  const [configSchema, setConfigSchema] = useState<any>(null);

  // Details / Info Modal
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  // Uninstall Modal
  const [uninstallModalOpen, setUninstallModalOpen] = useState(false);
  const [purgeData, setPurgeData] = useState(false);

  // Doctor Modal
  const [doctorModalOpen, setDoctorModalOpen] = useState(false);
  const [doctorReport, setDoctorReport] = useState<any | null>(null);
  const [doctorLoading, setDoctorLoading] = useState(false);

  // Active Menu Dropdown
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const fetchExtensions = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/admin/blueprint/extensions");
      setBlueprintCore(res.data.blueprint);
      setExtensions(res.data.extensions || []);
      setErrorMsg(null);
    } catch (err: any) {
      console.error("Failed to fetch blueprint extensions:", err);
      setErrorMsg(err.response?.data?.error || "Failed to connect to Blueprint Extension Manager.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExtensions();
  }, []);

  const handleValidateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extensionKey.trim()) return;

    setIsValidatingKey(true);
    setErrorMsg(null);
    try {
      const res = await axios.post("/api/admin/blueprint/extensions/validate-key", {
        key: extensionKey.trim(),
      });
      setKeyPreview(res.data);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || "Invalid extension key or registry unreachable.");
      setKeyPreview(null);
    } finally {
      setIsValidatingKey(false);
    }
  };

  const handleInstallConfirmed = async () => {
    if (!keyPreview && !uploadFile) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      if (installTab === "key") {
        await axios.post("/api/admin/blueprint/extensions/install", {
          key: extensionKey.trim(),
          grantedPermissions: keyPreview?.permissions || [],
        });
      } else if (uploadFile) {
        const formData = new FormData();
        formData.append("package", uploadFile);
        await axios.post("/api/admin/blueprint/extensions/install", formData);
      }

      setSuccessMsg(`Extension installed successfully!`);
      setAddModalOpen(false);
      setExtensionKey("");
      setKeyPreview(null);
      setUploadFile(null);
      await fetchExtensions();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || "Failed to install extension.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleEnable = async (ext: ExtensionItem) => {
    const extId = ext.manifest?.id || ext.id;
    if (!extId) return;

    setActionLoading(true);
    try {
      if (ext.enabled) {
        await axios.post(`/api/admin/blueprint/extensions/${extId}/disable`);
      } else {
        await axios.post(`/api/admin/blueprint/extensions/${extId}/enable`);
      }
      await fetchExtensions();
      setOpenMenuId(null);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || "Failed to update extension state.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenConfigure = async (ext: ExtensionItem) => {
    const extId = ext.manifest?.id || ext.id;
    if (!extId) return;

    setSelectedExt(ext);
    setOpenMenuId(null);
    try {
      const res = await axios.get(`/api/admin/blueprint/extensions/${extId}/configuration`);
      setConfigSchema(res.data.schema || ext.manifest?.configSchema || { fields: [] });
      setExtConfig(res.data.config || {});
      setConfigModalOpen(true);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || "Failed to fetch extension configuration.");
    }
  };

  const handleSaveConfiguration = async (e: React.FormEvent) => {
    e.preventDefault();
    const extId = selectedExt?.manifest?.id || selectedExt?.id;
    if (!extId) return;

    setActionLoading(true);
    try {
      await axios.put(`/api/admin/blueprint/extensions/${extId}/configuration`, {
        config: extConfig,
      });
      setSuccessMsg("Configuration saved successfully.");
      setConfigModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || "Failed to save configuration.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUninstall = async () => {
    const extId = selectedExt?.manifest?.id || selectedExt?.id;
    if (!extId) return;

    setActionLoading(true);
    try {
      await axios.delete(`/api/admin/blueprint/extensions/${extId}?purgeData=${purgeData}`);
      setSuccessMsg(`Extension '${extId}' uninstalled.`);
      setUninstallModalOpen(false);
      setSelectedExt(null);
      await fetchExtensions();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || "Failed to uninstall extension.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRunDoctor = async () => {
    setDoctorLoading(true);
    setDoctorModalOpen(true);
    try {
      const res = await axios.get("/api/admin/blueprint/doctor");
      setDoctorReport(res.data);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || "Failed to run Blueprint Doctor.");
    } finally {
      setDoctorLoading(false);
    }
  };

  return (
    <section id="blueprint" className="scroll-mt-24 bg-card border border-border-subtle rounded-2xl p-6 md:p-8 shadow-xl">
      {/* Toast Notifications */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-between font-mono text-sm"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white">
              <X size={16} />
            </button>
          </motion.div>
        )}

        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-center justify-between font-mono text-sm"
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={18} />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-white">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-xl font-bold flex items-center text-foreground">
            <Boxes className="mr-3 text-theme-500 w-5 h-5" /> Blueprint Extensions
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Manage extensions, install modules from the Blueprint Registry, and configure ecosystem integrations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRunDoctor}
            className="px-3.5 py-2 bg-white/[0.04] hover:bg-white/[0.08] text-foreground rounded-xl text-xs font-mono border border-border-subtle flex items-center gap-2 transition-colors"
          >
            <Stethoscope size={14} className="text-theme-400" />
            Doctor
          </button>
          <button
            onClick={() => {
              setAddModalOpen(true);
              setKeyPreview(null);
              setExtensionKey("");
            }}
            className="px-4 py-2 bg-theme-600 hover:bg-theme-500 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition-all shadow-md shadow-theme-600/20"
          >
            <Plus size={16} />
            Add Extension
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground font-mono text-sm">
          <RefreshCw className="w-5 h-5 animate-spin mr-3 text-theme-500" />
          Loading Blueprint Ecosystem...
        </div>
      ) : (
        <div className="space-y-4">
          {/* Blueprint Core Card */}
          {blueprintCore && (
            <div className="relative bg-gradient-to-r from-theme-950/40 via-card to-card border border-theme-500/30 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-theme-500/5 rounded-full blur-2xl -mr-10 -mt-10" />
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-theme-500/10 border border-theme-500/30 flex items-center justify-center text-theme-400 flex-shrink-0">
                  <Sparkles size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-foreground text-base">{blueprintCore.name}</h3>
                    <span className="px-2 py-0.5 rounded-full bg-theme-500/20 text-theme-300 font-mono text-[10px] tracking-wider uppercase border border-theme-500/30">
                      Core Framework
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                    {blueprintCore.description || "Extension framework runtime and security sandboxing engine."}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs font-mono text-faint">
                    <span>Version {blueprintCore.version}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Active
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-lg bg-white/[0.04] text-dim text-xs font-mono border border-border-subtle">
                  Built-in
                </span>
              </div>
            </div>
          )}

          {/* Installed Extensions List */}
          {extensions.length === 0 ? (
            <div className="text-center p-12 border border-dashed border-border-subtle rounded-2xl bg-white/[0.01]">
              <Layers size={36} className="mx-auto text-muted-foreground/40 mb-3" />
              <h4 className="font-semibold text-foreground text-sm">No Third-Party Extensions Installed</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                Discover plugins, add custom integrations, or install extensions from the official JTG Blueprint Registry.
              </p>
              <button
                onClick={() => setAddModalOpen(true)}
                className="mt-4 px-4 py-2 bg-white/[0.05] hover:bg-white/[0.1] text-foreground text-xs font-medium rounded-xl transition-colors inline-flex items-center gap-2 border border-border-subtle"
              >
                <Plus size={14} /> Add Your First Extension
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {extensions.map((ext) => {
                const extId = ext.manifest?.id || ext.id || "unknown";
                const extName = ext.manifest?.name || ext.name || extId;
                const extDesc = ext.manifest?.description || ext.description || "No description provided.";
                const extVer = ext.manifest?.version || ext.version || "1.0.0";
                const isMenuOpen = openMenuId === extId;

                return (
                  <div
                    key={extId}
                    className="relative bg-card border border-border-subtle hover:border-white/20 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white/[0.05] border border-border-subtle flex items-center justify-center text-theme-400 flex-shrink-0">
                        <Boxes size={22} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground text-sm">{extName}</h3>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${
                              ext.status === "active"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : ext.status === "disabled"
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            }`}
                          >
                            {ext.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 max-w-xl line-clamp-2">{extDesc}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs font-mono text-faint flex-wrap">
                          <span>v{extVer}</span>
                          {ext.manifest?.author?.name && (
                            <>
                              <span>•</span>
                              <span>By {ext.manifest.author.name}</span>
                            </>
                          )}
                          {ext.manifest?.compatibility && (
                            <>
                              <span>•</span>
                              <span className="text-dim">JTG {ext.manifest.compatibility.jtg_panel}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions & ⋮ Menu */}
                    <div className="flex items-center gap-2 self-end md:self-center relative">
                      {ext.manifest?.configSchema?.fields && ext.manifest.configSchema.fields.length > 0 && (
                        <button
                          onClick={() => handleOpenConfigure(ext)}
                          className="px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-foreground text-xs rounded-xl font-mono flex items-center gap-1.5 transition-colors border border-border-subtle"
                        >
                          <Settings size={14} />
                          Configure
                        </button>
                      )}

                      <div className="relative">
                        <button
                          onClick={() => setOpenMenuId(isMenuOpen ? null : extId)}
                          className="p-2 text-muted-foreground hover:text-white hover:bg-white/[0.06] rounded-xl transition-colors"
                          title="Extension Menu"
                        >
                          <MoreVertical size={18} />
                        </button>

                        {/* Three-Dot Menu Dropdown */}
                        <AnimatePresence>
                          {isMenuOpen && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: -5 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -5 }}
                              className="absolute right-0 top-full mt-2 w-48 bg-panel/95 backdrop-blur-xl border border-line rounded-xl shadow-2xl z-30 py-1.5 font-mono text-xs overflow-hidden"
                            >
                              {ext.manifest?.configSchema?.fields && (
                                <button
                                  onClick={() => handleOpenConfigure(ext)}
                                  className="w-full px-3 py-2 text-left text-dim hover:text-white hover:bg-white/[0.05] flex items-center gap-2 transition-colors"
                                >
                                  <Settings size={14} />
                                  Configure
                                </button>
                              )}

                              <button
                                onClick={() => handleToggleEnable(ext)}
                                className="w-full px-3 py-2 text-left text-dim hover:text-white hover:bg-white/[0.05] flex items-center gap-2 transition-colors"
                              >
                                <Power size={14} className={ext.enabled ? "text-amber-400" : "text-emerald-400"} />
                                {ext.enabled ? "Disable" : "Enable"}
                              </button>

                              <button
                                onClick={() => {
                                  setSelectedExt(ext);
                                  setDetailsModalOpen(true);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-3 py-2 text-left text-dim hover:text-white hover:bg-white/[0.05] flex items-center gap-2 transition-colors"
                              >
                                <Info size={14} />
                                View Details
                              </button>

                              <div className="h-px bg-white/[0.06] my-1" />

                              <button
                                onClick={() => {
                                  setSelectedExt(ext);
                                  setPurgeData(false);
                                  setUninstallModalOpen(true);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-3 py-2 text-left text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition-colors"
                              >
                                <Trash2 size={14} />
                                Uninstall
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* ADD EXTENSION MODAL */}
      {/* ────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {addModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-panel border border-line rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-5 border-b border-line flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-theme-500/10 text-theme-400">
                    <Plus size={18} />
                  </div>
                  <h3 className="font-bold text-foreground text-base">Add Blueprint Extension</h3>
                </div>
                <button
                  onClick={() => setAddModalOpen(false)}
                  className="text-muted-foreground hover:text-white p-1 rounded-lg hover:bg-white/[0.05]"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Tabs: Extension Key vs Upload */}
              <div className="flex border-b border-line px-5">
                <button
                  onClick={() => {
                    setInstallTab("key");
                    setKeyPreview(null);
                  }}
                  className={`py-3 px-4 text-xs font-mono border-b-2 transition-colors ${
                    installTab === "key"
                      ? "border-theme-500 text-white font-semibold"
                      : "border-transparent text-dim hover:text-white"
                  }`}
                >
                  Extension Key
                </button>
                <button
                  onClick={() => {
                    setInstallTab("upload");
                    setKeyPreview(null);
                  }}
                  className={`py-3 px-4 text-xs font-mono border-b-2 transition-colors ${
                    installTab === "upload"
                      ? "border-theme-500 text-white font-semibold"
                      : "border-transparent text-dim hover:text-white"
                  }`}
                >
                  Upload Package
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5">
                {installTab === "key" ? (
                  !keyPreview ? (
                    <form onSubmit={handleValidateKey} className="space-y-4">
                      <div>
                        <label className="block text-xs font-mono text-dim mb-2 uppercase tracking-wider">
                          Extension Key
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={extensionKey}
                            onChange={(e) => setExtensionKey(e.target.value)}
                            placeholder="e.g. jtg_key_..."
                            className="w-full bg-white/[0.03] border border-line rounded-xl px-4 py-3 text-sm text-foreground placeholder-faint focus:outline-none focus:border-theme-500 transition-colors font-mono"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Paste the secure installation key generated from the JTG Blueprint Registry.
                        </p>
                      </div>

                      <div className="pt-2 flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setAddModalOpen(false)}
                          className="px-4 py-2 text-xs font-mono text-dim hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isValidatingKey || !extensionKey.trim()}
                          className="px-5 py-2.5 bg-theme-600 hover:bg-theme-500 text-white rounded-xl text-xs font-mono font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                        >
                          {isValidatingKey ? (
                            <>
                              <RefreshCw size={14} className="animate-spin" />
                              Validating...
                            </>
                          ) : (
                            <>
                              Verify Key
                              <ChevronRight size={14} />
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  ) : (
                    /* Step 2: Permission & Confirmation Screen */
                    <div className="space-y-5">
                      <div className="bg-white/[0.02] border border-border-subtle p-4 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-foreground text-sm">{keyPreview.extensionName || keyPreview.name}</h4>
                          <span className="text-xs font-mono text-theme-400">v{keyPreview.version}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{keyPreview.description}</p>
                        {keyPreview.author?.name && (
                          <p className="text-[11px] font-mono text-faint">Developer: {keyPreview.author.name}</p>
                        )}
                        {keyPreview.compatibility && (
                          <div className="flex gap-2 text-[11px] font-mono text-dim pt-1">
                            <span>JTG Panel: {keyPreview.compatibility.jtg_panel}</span>
                            <span>•</span>
                            <span>Blueprint: {keyPreview.compatibility.blueprint}</span>
                          </div>
                        )}
                      </div>

                      {/* Requested Permissions Gate */}
                      <div>
                        <h5 className="text-xs font-mono text-foreground font-semibold flex items-center gap-2 mb-2">
                          <Shield size={14} className="text-amber-400" />
                          Requested Permissions:
                        </h5>

                        {keyPreview.permissionDefinitions && keyPreview.permissionDefinitions.length > 0 ? (
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {keyPreview.permissionDefinitions.map((perm: any) => (
                              <div
                                key={perm.id}
                                className="p-2.5 bg-white/[0.02] border border-border-subtle rounded-lg flex items-start gap-2 text-xs"
                              >
                                <span
                                  className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                                    perm.risk === "critical"
                                      ? "bg-red-500"
                                      : perm.risk === "high"
                                      ? "bg-amber-500"
                                      : "bg-emerald-500"
                                  }`}
                                />
                                <div>
                                  <p className="font-semibold text-foreground">{perm.name}</p>
                                  <p className="text-[11px] text-muted-foreground">{perm.description}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">No elevated permissions requested.</p>
                        )}
                      </div>

                      <div className="pt-2 flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setKeyPreview(null)}
                          className="px-4 py-2 text-xs font-mono text-dim hover:text-white"
                        >
                          Back
                        </button>
                        <button
                          onClick={handleInstallConfirmed}
                          disabled={actionLoading}
                          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-mono font-medium flex items-center gap-2 transition-colors"
                        >
                          {actionLoading ? (
                            <>
                              <RefreshCw size={14} className="animate-spin" />
                              Installing...
                            </>
                          ) : (
                            <>
                              <Check size={14} />
                              Confirm & Install
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  /* Upload Tab */
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-line rounded-xl p-6 text-center hover:border-theme-500 transition-colors">
                      <UploadCloud size={32} className="mx-auto text-muted-foreground mb-2" />
                      <p className="text-xs font-mono text-foreground">Select .blueprint or .zip package</p>
                      <input
                        type="file"
                        accept=".blueprint,.zip"
                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                        className="mt-3 block w-full text-xs text-dim file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-mono file:bg-white/[0.05] file:text-foreground hover:file:bg-white/[0.1]"
                      />
                    </div>
                    {uploadFile && (
                      <p className="text-xs font-mono text-theme-400">Selected: {uploadFile.name}</p>
                    )}

                    <div className="pt-2 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setAddModalOpen(false)}
                        className="px-4 py-2 text-xs font-mono text-dim hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleInstallConfirmed}
                        disabled={actionLoading || !uploadFile}
                        className="px-5 py-2.5 bg-theme-600 hover:bg-theme-500 text-white rounded-xl text-xs font-mono font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                      >
                        {actionLoading ? "Installing..." : "Install Package"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ────────────────────────────────────────────────────────── */}
      {/* CONFIGURATION MODAL */}
      {/* ────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {configModalOpen && selectedExt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-panel border border-line rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-5 border-b border-line flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-theme-500/10 text-theme-400">
                    <Settings size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-base">
                      Configure {selectedExt.manifest?.name || selectedExt.name}
                    </h3>
                    <p className="text-[11px] font-mono text-faint">
                      Extension ID: {selectedExt.manifest?.id || selectedExt.id}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setConfigModalOpen(false)}
                  className="text-muted-foreground hover:text-white p-1 rounded-lg hover:bg-white/[0.05]"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveConfiguration} className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                {configSchema?.fields && configSchema.fields.length > 0 ? (
                  configSchema.fields.map((field: any) => {
                    const val = extConfig[field.key] !== undefined ? extConfig[field.key] : field.default;

                    return (
                      <div key={field.key} className="space-y-1.5">
                        <label className="block text-xs font-mono text-foreground font-semibold">
                          {field.label}
                          {field.required && <span className="text-rose-400 ml-1">*</span>}
                        </label>

                        {field.type === "boolean" ? (
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={!!val}
                              onChange={(e) =>
                                setExtConfig((prev) => ({ ...prev, [field.key]: e.target.checked }))
                              }
                              className="w-4 h-4 rounded text-theme-600 bg-white/[0.05] border-line focus:ring-0"
                            />
                            <span className="text-xs text-muted-foreground">{field.description || "Enable option"}</span>
                          </div>
                        ) : field.type === "textarea" ? (
                          <textarea
                            value={val || ""}
                            rows={3}
                            onChange={(e) =>
                              setExtConfig((prev) => ({ ...prev, [field.key]: e.target.value }))
                            }
                            className="w-full bg-white/[0.03] border border-line rounded-xl p-3 text-xs text-foreground font-mono focus:outline-none focus:border-theme-500"
                          />
                        ) : field.type === "select" ? (
                          <select
                            value={val || ""}
                            onChange={(e) =>
                              setExtConfig((prev) => ({ ...prev, [field.key]: e.target.value }))
                            }
                            className="w-full bg-white/[0.03] border border-line rounded-xl p-2.5 text-xs text-foreground font-mono focus:outline-none focus:border-theme-500"
                          >
                            {field.options?.map((opt: any) => (
                              <option key={opt.value} value={opt.value} className="bg-panel text-white">
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={field.type === "number" ? "number" : field.type === "password" ? "password" : "text"}
                            value={val !== undefined ? val : ""}
                            min={field.min}
                            max={field.max}
                            onChange={(e) =>
                              setExtConfig((prev) => ({
                                ...prev,
                                [field.key]: field.type === "number" ? Number(e.target.value) : e.target.value,
                              }))
                            }
                            className="w-full bg-white/[0.03] border border-line rounded-xl px-3.5 py-2.5 text-xs text-foreground font-mono focus:outline-none focus:border-theme-500"
                          />
                        )}

                        {field.description && field.type !== "boolean" && (
                          <p className="text-[11px] text-faint">{field.description}</p>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-muted-foreground font-mono">No configurable schema declared by this extension.</p>
                )}

                <div className="pt-4 border-t border-line flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setConfigModalOpen(false)}
                    className="px-4 py-2 text-xs font-mono text-dim hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2.5 bg-theme-600 hover:bg-theme-500 text-white rounded-xl text-xs font-mono font-medium flex items-center gap-2 transition-colors"
                  >
                    {actionLoading ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ────────────────────────────────────────────────────────── */}
      {/* UNINSTALL CONFIRMATION MODAL */}
      {/* ────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {uninstallModalOpen && selectedExt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-panel border border-line rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center gap-3 text-rose-400">
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-base">Uninstall Extension?</h3>
                  <p className="text-xs text-muted-foreground">{selectedExt.manifest?.name || selectedExt.name}</p>
                </div>
              </div>

              <div className="p-3.5 bg-white/[0.02] border border-border-subtle rounded-xl text-xs text-muted-foreground space-y-1.5">
                <p>This action will remove:</p>
                <ul className="list-disc list-inside space-y-0.5 text-dim">
                  <li>Extension source code & assets</li>
                  <li>Dynamic routes and navigation links</li>
                </ul>
              </div>

              <label className="flex items-center gap-2 text-xs text-dim cursor-pointer">
                <input
                  type="checkbox"
                  checked={purgeData}
                  onChange={(e) => setPurgeData(e.target.checked)}
                  className="rounded text-rose-500 bg-white/[0.05] border-line focus:ring-0"
                />
                <span>Also wipe extension configuration & database records</span>
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setUninstallModalOpen(false)}
                  className="px-4 py-2 text-xs font-mono text-dim hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUninstall}
                  disabled={actionLoading}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-mono font-medium flex items-center gap-2 transition-colors"
                >
                  {actionLoading ? "Removing..." : "Uninstall"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ────────────────────────────────────────────────────────── */}
      {/* DOCTOR DIAGNOSTICS MODAL */}
      {/* ────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {doctorModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-panel border border-line rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-5 border-b border-line flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-theme-500/10 text-theme-400">
                    <Stethoscope size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-base">Blueprint Doctor</h3>
                    <p className="text-[11px] font-mono text-faint">System Integrity & Diagnostics</p>
                  </div>
                </div>
                <button
                  onClick={() => setDoctorModalOpen(false)}
                  className="text-muted-foreground hover:text-white p-1 rounded-lg hover:bg-white/[0.05]"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar space-y-4">
                {doctorLoading ? (
                  <div className="text-center py-8 text-xs font-mono text-dim flex items-center justify-center gap-2">
                    <RefreshCw className="animate-spin" size={16} />
                    Running diagnostic checks...
                  </div>
                ) : doctorReport ? (
                  <>
                    <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                      <div className="p-3 bg-white/[0.02] border border-border-subtle rounded-xl">
                        <span className="text-faint block">Framework</span>
                        <span className="text-foreground font-semibold">v{doctorReport.frameworkVersion}</span>
                      </div>
                      <div className="p-3 bg-white/[0.02] border border-border-subtle rounded-xl">
                        <span className="text-faint block">Panel Core</span>
                        <span className="text-foreground font-semibold">v{doctorReport.panelVersion}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-white/[0.02] border border-border-subtle rounded-xl flex items-center justify-between text-xs font-mono">
                      <span className="text-dim">Overall Health Status</span>
                      <span
                        className={`font-semibold uppercase ${
                          doctorReport.overallStatus === "healthy"
                            ? "text-emerald-400"
                            : doctorReport.overallStatus === "warnings"
                            ? "text-amber-400"
                            : "text-rose-400"
                        }`}
                      >
                        {doctorReport.overallStatus}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-xs font-mono text-dim mb-2 uppercase tracking-wider">Report Details</h4>
                      {doctorReport.issues.length === 0 ? (
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-mono flex items-center gap-2">
                          <CheckCircle2 size={16} />
                          All manifests, dependencies, and entrypoints are nominal.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {doctorReport.issues.map((issue: any, idx: number) => (
                            <div
                              key={idx}
                              className="p-3 bg-white/[0.02] border border-border-subtle rounded-xl text-xs font-mono space-y-1"
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                                    issue.type === "error"
                                      ? "bg-rose-500/20 text-rose-400"
                                      : "bg-amber-500/20 text-amber-400"
                                  }`}
                                >
                                  {issue.type}
                                </span>
                                {issue.extensionId && (
                                  <span className="text-foreground font-semibold">[{issue.extensionId}]</span>
                                )}
                              </div>
                              <p className="text-dim">{issue.message}</p>
                              {issue.resolution && (
                                <p className="text-theme-400 text-[11px]">↳ Resolution: {issue.resolution}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ────────────────────────────────────────────────────────── */}
      {/* EXTENSION DETAILS MODAL */}
      {/* ────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {detailsModalOpen && selectedExt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-panel border border-line rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-foreground text-base">
                    {selectedExt.manifest?.name || selectedExt.name}
                  </h3>
                  <p className="text-xs font-mono text-theme-400">
                    ID: {selectedExt.manifest?.id || selectedExt.id} • v
                    {selectedExt.manifest?.version || selectedExt.version}
                  </p>
                </div>
                <button
                  onClick={() => setDetailsModalOpen(false)}
                  className="text-muted-foreground hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs text-muted-foreground">
                {selectedExt.manifest?.description || selectedExt.description}
              </p>

              <div className="space-y-2 pt-2 border-t border-line text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-faint">Developer</span>
                  <span className="text-foreground">
                    {selectedExt.manifest?.author?.name || selectedExt.author?.name || "Unknown"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-faint">Status</span>
                  <span className="text-emerald-400 uppercase">{selectedExt.status}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-faint">JTG Panel Compatibility</span>
                  <span className="text-foreground">
                    {selectedExt.manifest?.compatibility?.jtg_panel || ">=2.0.0"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-faint">Blueprint Compatibility</span>
                  <span className="text-foreground">
                    {selectedExt.manifest?.compatibility?.blueprint || ">=1.0.0"}
                  </span>
                </div>
              </div>

              {selectedExt.grantedPermissions && selectedExt.grantedPermissions.length > 0 && (
                <div className="pt-2">
                  <h4 className="text-xs font-mono text-dim mb-2 uppercase">Granted Permissions</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedExt.grantedPermissions.map((perm) => (
                      <span
                        key={perm}
                        className="px-2 py-0.5 rounded bg-white/[0.05] border border-border-subtle text-[11px] font-mono text-dim"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
