"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, GripVertical, Copy } from "lucide-react";
import { DeleteIcon } from "@/components/ui/delete";

export interface TestCase {
  _id?: string;
  name: string;
  inputs: Record<string, string>;
  expectedOutput?: string;
  notes?: string;
}

interface TestCaseEditorProps {
  testCases: TestCase[];
  variables: string[];
  onChange: (testCases: TestCase[]) => void;
}

export function TestCaseEditor({
  testCases,
  variables,
  onChange,
}: TestCaseEditorProps) {
  const [editingCase, setEditingCase] = useState<TestCase | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleAddCase = () => {
    const newCase: TestCase = {
      name: `Test Case ${testCases.length + 1}`,
      inputs: variables.reduce((acc, v) => ({ ...acc, [v]: "" }), {}),
      expectedOutput: "",
      notes: "",
    };
    setEditingCase(newCase);
    setEditingIndex(null);
    setDialogOpen(true);
  };

  const handleEditCase = (testCase: TestCase, index: number) => {
    // Ensure all variables are in inputs
    const inputs = { ...testCase.inputs };
    for (const v of variables) {
      if (!(v in inputs)) {
        inputs[v] = "";
      }
    }
    setEditingCase({ ...testCase, inputs });
    setEditingIndex(index);
    setDialogOpen(true);
  };

  const handleDeleteCase = (index: number) => {
    const updated = testCases.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleDuplicateCase = (testCase: TestCase) => {
    const duplicatedCase: TestCase = {
      ...testCase,
      _id: undefined, // Remove _id so it gets a new one when saved
      name: `${testCase.name} (copy)`,
    };
    onChange([...testCases, duplicatedCase]);
  };

  const handleSaveCase = () => {
    if (!editingCase) return;

    if (editingIndex === null) {
      onChange([...testCases, editingCase]);
    } else {
      const updated = [...testCases];
      updated[editingIndex] = editingCase;
      onChange(updated);
    }
    setDialogOpen(false);
    setEditingCase(null);
    setEditingIndex(null);
  };

  const updateEditingInput = (key: string, value: string) => {
    if (!editingCase) return;
    setEditingCase({
      ...editingCase,
      inputs: { ...editingCase.inputs, [key]: value },
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Test Cases</CardTitle>
            <CardDescription>
              Define test cases with variable values
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={handleAddCase}>
                <Plus className="mr-2 h-4 w-4" />
                Add Test Case
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingIndex === null ? "Add Test Case" : "Edit Test Case"}
                </DialogTitle>
                <DialogDescription>
                  Define inputs for this test case
                </DialogDescription>
              </DialogHeader>
              {editingCase && (
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="case-name">Name</Label>
                    <Input
                      id="case-name"
                      value={editingCase.name}
                      onChange={(e) =>
                        setEditingCase({ ...editingCase, name: e.target.value })
                      }
                      placeholder="Test case name"
                    />
                  </div>

                  {variables.length > 0 ? (
                    <div className="space-y-3">
                      <Label>Variables</Label>
                      {variables.map((varName) => (
                        <div key={varName} className="space-y-1">
                          <Label
                            htmlFor={`var-${varName}`}
                            className="text-sm text-muted-foreground"
                          >
                            {`{{${varName}}}`}
                          </Label>
                          <Input
                            id={`var-${varName}`}
                            value={editingCase.inputs[varName] || ""}
                            onChange={(e) =>
                              updateEditingInput(varName, e.target.value)
                            }
                            placeholder={`Value for ${varName}`}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No variables detected. Add variables to your prompt/endpoint
                      using {"{{variable}}"} syntax.
                    </p>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="expected-output">
                      Expected Output (optional)
                    </Label>
                    <Textarea
                      id="expected-output"
                      value={editingCase.expectedOutput || ""}
                      onChange={(e) =>
                        setEditingCase({
                          ...editingCase,
                          expectedOutput: e.target.value,
                        })
                      }
                      placeholder="What output do you expect? (used by LLM judge)"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      value={editingCase.notes || ""}
                      onChange={(e) =>
                        setEditingCase({
                          ...editingCase,
                          notes: e.target.value,
                        })
                      }
                      placeholder="Any notes about this test case"
                      rows={2}
                    />
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveCase}>
                  {editingIndex === null ? "Add" : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {testCases.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No test cases yet.</p>
            <p className="text-sm">Add test cases to run tests.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {testCases.map((testCase, index) => (
              <div
                key={testCase._id || index}
                className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg group"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{testCase.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {Object.entries(testCase.inputs)
                      .filter(([, v]) => v)
                      .map(([k, v]) => `${k}: "${v}"`)
                      .join(", ") || "No inputs"}
                  </div>
                  {testCase.expectedOutput && (
                    <div className="text-xs text-muted-foreground truncate mt-1 italic">
                      Expected: {testCase.expectedOutput}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleEditCase(testCase, index)}
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDuplicateCase(testCase)}
                    title="Duplicate"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDeleteCase(index)}
                    title="Delete"
                  >
                    <DeleteIcon size={16} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
