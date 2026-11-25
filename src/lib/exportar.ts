export interface Tabla {
  columnas: string[];
  filas: (string | number)[][];
}

// CSV con BOM y ';': Excel en español lo abre con acentos y columnas correctas.
export function tablaACsv({ columnas, filas }: Tabla): string {
  const celda = (valor: string | number) => {
    const texto = String(valor);
    return /[;"\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  return '﻿' + [columnas, ...filas].map(fila => fila.map(celda).join(';')).join('\r\n');
}

export function descargarExcel(tabla: Tabla, nombreArchivo: string) {
  const blob = new Blob([tablaACsv(tabla)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nombreArchivo}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// El navegador abre "Imprimir", donde se elige "Guardar como PDF".
// El título del documento se usa como nombre del archivo.
export function imprimirPdf(nombreArchivo: string) {
  const tituloAnterior = document.title;
  document.title = nombreArchivo;
  const restaurar = () => {
    document.title = tituloAnterior;
    window.removeEventListener('afterprint', restaurar);
  };
  window.addEventListener('afterprint', restaurar);
  window.print();
}
