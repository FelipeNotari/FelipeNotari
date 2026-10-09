/** Caminho em coordenadas de casa (centro da casa = x + 0,5). */
export class Path {
  readonly xs: Float64Array;
  readonly ys: Float64Array;
  readonly cum: Float64Array; // distância acumulada até o ponto i
  readonly length: number;
  readonly air: boolean;
  /** amostras a cada 0,25 casa (para cálculo de cobertura) */
  readonly sx: Float32Array;
  readonly sy: Float32Array;

  constructor(points: number[][], air: boolean) {
    this.air = air;
    const n = points.length;
    this.xs = new Float64Array(n);
    this.ys = new Float64Array(n);
    this.cum = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      this.xs[i] = points[i][0] + 0.5;
      this.ys[i] = points[i][1] + 0.5;
      if (i > 0) {
        const dx = this.xs[i] - this.xs[i - 1];
        const dy = this.ys[i] - this.ys[i - 1];
        this.cum[i] = this.cum[i - 1] + Math.sqrt(dx * dx + dy * dy);
      }
    }
    this.length = this.cum[n - 1];
    const ns = Math.max(2, Math.ceil(this.length / 0.25));
    this.sx = new Float32Array(ns);
    this.sy = new Float32Array(ns);
    const tmp = { x: 0, y: 0, a: 0, seg: 0 };
    for (let i = 0; i < ns; i++) {
      this.posAt((i + 0.5) * (this.length / ns), tmp);
      this.sx[i] = tmp.x;
      this.sy[i] = tmp.y;
    }
  }

  /** Escreve posição/ângulo na distância d em `out`. Usa out.seg como dica de segmento. */
  posAt(d: number, out: { x: number; y: number; a: number; seg: number }): void {
    const n = this.xs.length;
    if (d <= 0) {
      out.x = this.xs[0];
      out.y = this.ys[0];
      out.a = Math.atan2(this.ys[1] - this.ys[0], this.xs[1] - this.xs[0]);
      out.seg = 0;
      return;
    }
    if (d >= this.length) {
      out.x = this.xs[n - 1];
      out.y = this.ys[n - 1];
      out.a = Math.atan2(this.ys[n - 1] - this.ys[n - 2], this.xs[n - 1] - this.xs[n - 2]);
      out.seg = n - 2;
      return;
    }
    let s = out.seg;
    if (s < 0 || s > n - 2) s = 0;
    while (s < n - 2 && this.cum[s + 1] < d) s++;
    while (s > 0 && this.cum[s] > d) s--;
    const segLen = this.cum[s + 1] - this.cum[s];
    const t = segLen > 0 ? (d - this.cum[s]) / segLen : 0;
    const dx = this.xs[s + 1] - this.xs[s];
    const dy = this.ys[s + 1] - this.ys[s];
    out.x = this.xs[s] + dx * t;
    out.y = this.ys[s] + dy * t;
    out.a = Math.atan2(dy, dx);
    out.seg = s;
  }

  /** Comprimento do caminho dentro do anel [rMin, rMax] ao redor de (x, y). */
  coverage(x: number, y: number, rMax: number, rMin = 0): number {
    const step = this.length / this.sx.length;
    const r2 = rMax * rMax;
    const m2 = rMin * rMin;
    let c = 0;
    for (let i = 0; i < this.sx.length; i++) {
      const dx = this.sx[i] - x;
      const dy = this.sy[i] - y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= r2 && d2 >= m2) c++;
    }
    return c * step;
  }

  /** Distância (ao longo do caminho) do ponto mais próximo de (x, y). */
  nearestDist(x: number, y: number): { d: number; dist2: number } {
    const step = this.length / this.sx.length;
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < this.sx.length; i++) {
      const dx = this.sx[i] - x;
      const dy = this.sy[i] - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bd) {
        bd = d2;
        best = i;
      }
    }
    return { d: (best + 0.5) * step, dist2: bd };
  }
}
