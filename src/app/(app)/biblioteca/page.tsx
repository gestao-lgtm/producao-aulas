import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { mockFiles, mockLessons } from "@/lib/mock/data";
import { FileText, Download, Eye, Clock, ChevronRight, Filter } from "lucide-react";

const FILE_TYPE_LABELS: Record<string, string> = {
  TEORIA_BRUTA: "Teoria Bruta",
  TEORIA_EDITADA: "Teoria Editada",
  TEORIA_PDF: "PDF Teoria",
  QUESTOES_BRUTAS: "Questões Brutas",
  QUESTOES_EDITORIAL: "Questões Editorial",
  QUESTOES_COMENTADAS: "Questões Comentadas",
  CADERNO_GERAL: "Caderno Geral",
  CADERNO_TOPICO: "Caderno por Tópico",
  CADERNO_BANCA: "Caderno por Banca",
  REVISAO: "Revisão",
  SLIDES: "Slides",
  GABARITO: "Gabarito",
  AUXILIAR_TEORIA: "Auxiliar de Teoria",
  LISTA_QUESTOES: "Lista de Questões",
  PACOTE_PUBLICACAO: "Pacote de Publicação",
  OUTRO: "Outro",
};

const FILE_COLORS: Record<string, string> = {
  TEORIA_BRUTA: "text-blue-500",
  TEORIA_EDITADA: "text-blue-700",
  TEORIA_PDF: "text-red-500",
  QUESTOES_BRUTAS: "text-yellow-500",
  QUESTOES_EDITORIAL: "text-yellow-700",
  QUESTOES_COMENTADAS: "text-green-600",
  CADERNO_GERAL: "text-purple-500",
  CADERNO_BANCA: "text-purple-600",
  SLIDES: "text-orange-500",
  GABARITO: "text-gray-600",
};

export default function BibliotecaPage() {
  const allFiles = [...mockFiles, ...mockFiles.map(f => ({ ...f, id: f.id + "-2", name: f.name.replace(".docx", "-v2.docx"), version: f.version + 1 }))];

  return (
    <div className="pt-16">
      <Topbar title="Biblioteca de Arquivos" />
      <main className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Biblioteca de Arquivos</h2>
            <p className="text-sm text-gray-500">{allFiles.length} arquivos gerados em todas as aulas</p>
          </div>
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filtrar
          </Button>
        </div>

        {/* Files by Lesson */}
        {mockLessons.slice(0, 2).map(lesson => (
          <Card key={lesson.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">{lesson.code} — {lesson.title}</CardTitle>
                  <p className="text-xs text-gray-400 mt-0.5">{lesson.discipline.name}</p>
                </div>
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  Ver aula <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-50">
                {mockFiles.map(file => {
                  const colorClass = FILE_COLORS[file.fileType] || "text-gray-500";
                  return (
                    <div key={file.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                      <FileText className={`h-4 w-4 shrink-0 ${colorClass}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {FILE_TYPE_LABELS[file.fileType] || file.fileType} · v{file.version}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Clock className="h-3 w-3" />
                        {file.createdAt.toLocaleDateString("pt-BR")}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}
