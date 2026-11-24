/** Shared formatting for Carlos's embeds: short numbers and aligned tables. No emojis (alliance house style). */
/** 83775007 -> "83.8M", 570000 -> "570K", 63600 -> "63.6K", 950 -> "950". */
export function short(n) {
    if (n === null || n === undefined || !Number.isFinite(n))
        return "-";
    const a = Math.abs(n);
    const fix = (v) => (v >= 100 ? Math.round(v).toString() : v.toFixed(1).replace(/\.0$/, ""));
    if (a >= 1e9)
        return `${fix(n / 1e9)}B`;
    if (a >= 1e6)
        return `${fix(n / 1e6)}M`;
    if (a >= 1e4)
        return `${fix(n / 1e3)}K`;
    return Math.round(n).toLocaleString("en-US");
}
/** 0.138 -> "+14%"; `signed` false -> "14%". */
export function percent(n, signed = true) {
    if (n === null || n === undefined || !Number.isFinite(n))
        return "-";
    const v = Math.round(n * 100);
    return `${signed && v > 0 ? "+" : ""}${v}%`;
}
/** "2026-11-16" -> "16.11." (the alliance reads dates day first). */
export function dayMonth(date) {
    const m = /^\d{4}-(\d{2})-(\d{2})/.exec(date);
    return m ? `${m[2]}.${m[1]}.` : date;
}
/**
 * An aligned table in a code block (Discord renders no Markdown tables). Numbers go right, text left. Keep it
 * narrow: phones show about 40 characters before the block scrolls sideways.
 */
export function table(head, rows, align) {
    const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)));
    const line = (cells) => cells
        .map((c, i) => ((align[i] ?? "l") === "r" ? c.padStart(widths[i] ?? 0) : c.padEnd(widths[i] ?? 0)))
        .join(" ")
        .trimEnd();
    return ["```", line(head), ...rows.map(line), "```"].join("\n");
}
/** Cuts a text to `max` characters, ending with an ellipsis. */
export function cut(text, max) {
    return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
//# sourceMappingURL=format.js.map