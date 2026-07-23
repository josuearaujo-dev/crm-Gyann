"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Upload, CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function ImportLeadsPage() {
  const [jsonInput, setJsonInput] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleImport = async () => {
    if (!jsonInput.trim()) {
      alert("Por favor, cole o JSON dos leads");
      return;
    }

    setIsImporting(true);
    setResult(null);

    try {
      const leads = JSON.parse(jsonInput);

      const response = await fetch("/api/leads/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(leads),
      });

      const data = await response.json();
      setResult(data);

      if (data.success) {
        setJsonInput("");
      }
    } catch (err: any) {
      setResult({
        success: false,
        error: err.message,
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Importar Leads</h1>
        <p className="text-muted-foreground mt-1">
          Cole o JSON dos leads para importar em lote
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>JSON dos Leads</CardTitle>
          <CardDescription>
            Cole aqui o array JSON com os leads. Os placeholders serão substituídos automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder='[{"name": "João Silva", "email": "joao@email.com", ...}]'
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            rows={15}
            className="font-mono text-sm"
          />

          <Button
            onClick={handleImport}
            disabled={isImporting || !jsonInput.trim()}
            className="w-full"
          >
            {isImporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Importar Leads
              </>
            )}
          </Button>

          {result && (
            <Card className={result.success ? "border-green-500" : "border-red-500"}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {result.success ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      Importação Concluída
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-red-600" />
                      Erro na Importação
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm">{result.message || result.error}</p>

                {result.results && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {result.results.success}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Importados com sucesso
                      </div>
                    </div>
                    <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">
                        {result.results.failed}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Falharam
                      </div>
                    </div>
                  </div>
                )}

                {result.results?.errors && result.results.errors.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Erros:</h4>
                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {result.results.errors.map((err: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-3 bg-muted rounded text-sm"
                        >
                          <p className="font-medium">{err.lead?.name || "Lead sem nome"}</p>
                          <p className="text-red-600 dark:text-red-400">{err.error}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Formato Esperado</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted p-4 rounded overflow-x-auto">
{`[
  {
    "name": "João Silva",
    "email": "joao@email.com",
    "phone": "+5511999887766",
    "company": "Empresa XYZ",
    "deal_value": 5000,
    "column_id": "uuid-da-coluna-do-pipeline", // Opcional
    "source_id": "uuid-da-fonte-de-leads", // Opcional
    "assigned_to": "uuid-do-usuario-responsavel", // Opcional
    "metadata": {
      "segmento": "Pizzerias",
      "faturamento": "Up to 20,000"
    }
  }
]`}
          </pre>
          <p className="text-sm text-muted-foreground mt-4">
            <strong>Nota:</strong> Os placeholders como "uuid-da-fonte-de-leads" serão automaticamente substituídos pelos valores reais do banco de dados.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
