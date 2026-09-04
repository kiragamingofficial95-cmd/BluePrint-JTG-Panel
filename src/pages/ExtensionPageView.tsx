import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { Boxes, ArrowLeft, RefreshCw, Settings, Shield, ExternalLink, Sparkles, CheckCircle2 } from "lucide-react";
import PageHeader from "../components/PageHeader";

export default function ExtensionPageView() {
  const { id } = useParams<{ id: string }>();
  const [extension, setExtension] = useState<any>(null);
  const [extData, setExtData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    axios
      .get(`/api/admin/blueprint/extensions/${id}`)
      .then((res) => {
        setExtension(res.data.extension);
        // Call extension's custom status endpoint if exists
        const apiPrefix = res.data.extension?.manifest?.routes?.apiPrefix || `/api/extensions/${id}`;
        axios
          .get(`${apiPrefix}/status`)
          .then((statusRes) => setExtData(statusRes.data))
          .catch(() => {});
      })
      .catch((err) => {
        setError(err.response?.data?.error || "Extension not found.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 font-mono text-xs text-dim">
        <RefreshCw className="animate-spin mr-2" size={16} />
        Loading extension interface...
      </div>
    );
  }

  if (error || !extension) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-4">
        <Link to="/admin/settings" className="text-xs font-mono text-dim hover:text-white flex items-center gap-1">
          <ArrowLeft size={14} /> Back to Admin Settings
        </Link>
        <div className="p-6 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl font-mono text-sm">
          {error || "Extension not found or currently inactive."}
        </div>
      </div>
    );
  }

  const manifest = extension.manifest || {};

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/admin/settings" className="text-xs font-mono text-dim hover:text-white flex items-center gap-1.5">
          <ArrowLeft size={14} /> Back to Admin Settings
        </Link>
        <span
          className={`px-3 py-1 rounded-full text-xs font-mono uppercase tracking-wider ${
            extension.status === "active"
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
          }`}
        >
          {extension.status}
        </span>
      </div>

      <PageHeader
        title={manifest.name || id || "Extension"}
        subtitle={manifest.description || "JTG Blueprint Extension"}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Status / Content Card */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-card border border-border-subtle rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-theme-500/10 border border-theme-500/20 rounded-xl text-theme-400">
                <Boxes size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">{manifest.name} Extension Runtime</h3>
                <p className="text-xs text-muted-foreground font-mono">Module ID: {manifest.id}</p>
              </div>
            </div>

            {extData ? (
              <div className="p-4 bg-white/[0.02] border border-border-subtle rounded-xl font-mono text-xs space-y-2">
                <p className="text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> Extension Backend Route Connected
                </p>
                <div className="bg-black/30 p-3 rounded-lg overflow-x-auto text-[11px] text-faint">
                  <pre>{JSON.stringify(extData, null, 2)}</pre>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-white/[0.02] border border-border-subtle rounded-xl font-mono text-xs text-dim">
                Extension backend initialized and ready.
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Info Card */}
        <div className="space-y-6">
          <div className="bg-card border border-border-subtle rounded-2xl p-6 shadow-xl space-y-4">
            <h4 className="text-xs font-mono text-dim uppercase tracking-wider">Extension Details</h4>

            <div className="space-y-3 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-faint">Version</span>
                <span className="text-foreground">v{manifest.version}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-faint">Developer</span>
                <span className="text-foreground">{manifest.author?.name || "Unknown"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-faint">JTG Panel</span>
                <span className="text-foreground">{manifest.compatibility?.jtg_panel || ">=2.0.0"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-faint">Blueprint</span>
                <span className="text-foreground">{manifest.compatibility?.blueprint || ">=1.0.0"}</span>
              </div>
            </div>

            {manifest.permissions && manifest.permissions.length > 0 && (
              <div className="pt-2">
                <h5 className="text-[11px] font-mono text-dim mb-2 uppercase flex items-center gap-1.5">
                  <Shield size={12} className="text-amber-400" />
                  Permissions
                </h5>
                <div className="flex flex-wrap gap-1.5">
                  {manifest.permissions.map((p: string) => (
                    <span
                      key={p}
                      className="px-2 py-0.5 rounded bg-white/[0.04] border border-border-subtle text-[10px] font-mono text-dim"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
