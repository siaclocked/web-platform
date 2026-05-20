"use client";

import { useState, useEffect } from "react";
import { PageContainer } from "@/components/layout";
import { Card, CardContent, Button, Input, Badge } from "@/components/ui";
import { Briefcase, Plus, Edit2, Trash2, Users, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface PositionWorker {
  id: string;
  name: string;
}

interface Position {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  worker_count?: number;
  workers?: PositionWorker[];
}

export default function ManagerPositionsPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingPosition, setIsAddingPosition] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  // Form-level save outcome — drives the submit button's variant + label for ~2.5s after save.
  const [saveResult, setSaveResult] = useState<"success" | "error" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchPositions();
  }, []);

  const fetchPositions = async () => {
    try {
      // Get auth token
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch("/api/manager/positions", {
        headers: {
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPositions(data.positions || []);
      }
    } catch (error) {
      console.error("Error fetching positions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaveResult(null);

    if (!formData.name.trim()) {
      setError("Position name is required");
      return;
    }

    setIsSubmitting(true);
    let outcome: "success" | "error" = "error";
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const url = editingPosition
        ? `/api/manager/positions/${editingPosition.id}`
        : "/api/manager/positions";

      const method = editingPosition ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        outcome = "success";
        setSaveResult("success");
        await fetchPositions();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save position");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save position");
      setSaveResult("error");
    } finally {
      setIsSubmitting(false);
      setTimeout(() => {
        setSaveResult(null);
        setError("");
        if (outcome === "success") {
          setFormData({ name: "", description: "" });
          setIsAddingPosition(false);
          setEditingPosition(null);
        }
      }, 2500);
    }
  };

  const handleEdit = (position: Position) => {
    setEditingPosition(position);
    setFormData({
      name: position.name,
      description: position.description || "",
    });
    setIsAddingPosition(true);
  };

  const handleDelete = async (positionId: string) => {
    if (!confirm("Are you sure you want to delete this position?")) {
      return;
    }

    try {
      // Get auth token
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(`/api/manager/positions/${positionId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
      });

      if (response.ok) {
        setSuccess("Position deleted successfully!");
        setTimeout(() => setSuccess(""), 2500);
        fetchPositions();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete position");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete position",
      );
    }
  };

  const handleCancel = () => {
    setIsAddingPosition(false);
    setEditingPosition(null);
    setFormData({ name: "", description: "" });
    setError("");
    setSuccess("");
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">Positions</h1>
            <Button
              onClick={() => setIsAddingPosition(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Position
            </Button>
          </div>
          <p className="text-foreground-muted">
            Manage job positions for your workers
          </p>
        </div>

        {/* Add/Edit Position Form */}
        {isAddingPosition && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                {editingPosition ? "Edit Position" : "Add New Position"}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Position Name *
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Waiter, Cook, Security"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Description
                  </label>
                  <Input
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Optional description of the position"
                  />
                </div>

                {error && saveResult !== "success" && (
                  <div className="p-3 bg-danger-muted/20 border border-danger/30 rounded-lg">
                    <p className="text-sm text-danger">{error}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  {(() => {
                    const variant =
                      saveResult === "success" ? "success"
                      : saveResult === "error" ? "danger"
                      : "primary";
                    const baseLabel = editingPosition ? "Update Position" : "Add Position";
                    const label =
                      saveResult === "success" ? (editingPosition ? "Updated!" : "Added!")
                      : saveResult === "error" ? "Save failed — retry"
                      : baseLabel;
                    return (
                      <Button type="submit" variant={variant} isLoading={isSubmitting}>
                        {label}
                      </Button>
                    );
                  })()}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Success / Error banners */}
        {success && (
          <div className="p-3 mb-4 bg-success-muted/20 border border-success/30 rounded-lg">
            <p className="text-sm text-success">{success}</p>
          </div>
        )}

        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground-muted w-4 h-4" />
            <Input
              type="text"
              placeholder="Search positions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Positions List */}
        <div className="space-y-4">
          {positions.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Briefcase className="w-12 h-12 mx-auto mb-4 text-foreground-muted" />
                <h3 className="text-lg font-medium mb-2">No positions yet</h3>
                <p className="text-foreground-muted mb-4">
                  Add your first position to get started
                </p>
                <Button onClick={() => setIsAddingPosition(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Position
                </Button>
              </CardContent>
            </Card>
          ) : (
            positions.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || (p.description || '').toLowerCase().includes(searchTerm.toLowerCase())).map((position) => (
              <Card key={position.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-foreground mb-1">
                        {position.name}
                      </h3>
                      {position.description && (
                        <p className="text-sm text-foreground-muted mb-2">
                          {position.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-foreground-muted">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span>{position.worker_count || 0} workers</span>
                        </div>
                        <span>
                          Created{" "}
                          {new Date(position.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {position.workers && position.workers.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {position.workers.map((w) => (
                            <Badge key={w.id} variant="default" className="text-xs">
                              {w.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(position)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(position.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </PageContainer>
  );
}
