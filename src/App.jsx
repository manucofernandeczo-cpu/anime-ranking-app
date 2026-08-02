import { useState, useEffect, useRef } from "react";
import { GripVertical, Plus, X, ImageOff, Sparkles, Upload } from "lucide-react";
import { idbGet, idbSet } from "./idb.js";

const ACCENT = "#FF4655";
const ACCENT_SOFT = "#FF465522";
const STORAGE_KEY = "anime-ranking-list";
const MAX_DIM = 500; // px, para no guardar imágenes gigantes

const seed = [
  { id: "seed-1", name: "Frieren: Beyond Journey's End", image: "" },
  { id: "seed-2", name: "Kaiju No. 8", image: "" },
  { id: "seed-3", name: "Vinland Saga", image: "" },
];

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// Redimensiona y comprime la imagen elegida a base64 (JPEG), para no llenar el almacenamiento.
function fileToCompressedDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("No se pudo leer la imagen"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > MAX_DIM) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else if (height > MAX_DIM) {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const [items, setItems] = useState(seed);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [saveState, setSaveState] = useState("idle");
  const fileInputRef = useRef(null);
  const listRef = useRef(null);
  const draggingRef = useRef(null); // guarda el id que se está arrastrando, sin re-render

  useEffect(() => {
    (async () => {
      try {
        const stored = await idbGet(STORAGE_KEY);
        if (Array.isArray(stored) && stored.length > 0) setItems(stored);
      } catch (e) {
        // sin datos guardados aún, se queda con el seed
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      try {
        await idbSet(STORAGE_KEY, items);
        setSaveState("saved");
      } catch (e) {
        setSaveState("error");
      }
    }, 250);
    return () => clearTimeout(t);
  }, [items, loaded]);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setImagePreview(dataUrl);
    } catch (err) {
      alert("No se pudo procesar esa imagen. Prueba con otra.");
    }
  }

  function addAnime() {
    if (!name.trim()) return;
    setItems((prev) => [...prev, { id: uid(), name: name.trim(), image: imagePreview }]);
    setName("");
    setImagePreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeAnime(id) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  // --- Arrastre táctil (funciona con el dedo, a diferencia del drag HTML5) ---
  function handlePointerDownOnGrip(e, id) {
    e.preventDefault();
    draggingRef.current = id;
    setDragId(id);
    // Capturamos el puntero en el elemento del documento para poder seguirlo
    // aunque el dedo se mueva fuera del elemento original.
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  }

  function handlePointerMove(e) {
    if (!draggingRef.current || !listRef.current) return;
    const point = e.touches ? e.touches[0] : e;
    const el = document.elementFromPoint(point.clientX, point.clientY);
    const li = el?.closest?.("[data-item-id]");
    if (!li) return;
    const targetId = li.getAttribute("data-item-id");
    if (targetId && targetId !== draggingRef.current) {
      setOverId(targetId);
      setItems((prev) => {
        const arr = [...prev];
        const fromIdx = arr.findIndex((i) => i.id === draggingRef.current);
        const toIdx = arr.findIndex((i) => i.id === targetId);
        if (fromIdx === -1 || toIdx === -1) return prev;
        const [moved] = arr.splice(fromIdx, 1);
        arr.splice(toIdx, 0, moved);
        return arr;
      });
    }
  }

  function handlePointerUp() {
    draggingRef.current = null;
    setDragId(null);
    setOverId(null);
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("pointercancel", handlePointerUp);
  }

  function moveByStep(id, dir) {
    setItems((prev) => {
      const arr = [...prev];
      const idx = arr.findIndex((i) => i.id === id);
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= arr.length) return prev;
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0B0B0F",
        color: "#F2F1ED",
        fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
        padding: "32px 16px 80px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <header style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
            <Sparkles size={22} color={ACCENT} strokeWidth={2.5} />
            <h1
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 900,
                fontSize: 36,
                letterSpacing: "-0.02em",
                margin: 0,
                textTransform: "uppercase",
              }}
            >
              Mi Ranking de Anime
            </h1>
          </div>
          <p style={{ fontFamily: "Barlow, sans-serif", color: "#8B8A94", fontSize: 15, margin: 0 }}>
            Mantén presionado el ícono ⠿ y arrastra para reordenar. Funciona sin conexión, todo se guarda en tu celular.
          </p>
        </header>

        <div
          style={{
            background: "#151419",
            border: "1px solid #232228",
            borderRadius: 14,
            padding: 16,
            marginBottom: 28,
          }}
        >
          <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
            <label
              style={{
                width: 64,
                height: 64,
                flexShrink: 0,
                borderRadius: 8,
                border: `1.5px dashed ${imagePreview ? ACCENT : "#3A3940"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                cursor: "pointer",
                background: "#0B0B0F",
                position: "relative",
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: 0,
                  cursor: "pointer",
                }}
              />
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="preview"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <Upload size={20} color="#5C5B64" />
              )}
            </label>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addAnime()}
                placeholder="Nombre del anime"
                style={{
                  background: "#0B0B0F",
                  border: "1px solid #2A2930",
                  borderRadius: 8,
                  padding: "10px 12px",
                  color: "#F2F1ED",
                  fontFamily: "Barlow, sans-serif",
                  fontSize: 15,
                  outline: "none",
                }}
              />
              <span style={{ fontFamily: "Barlow, sans-serif", fontSize: 12, color: "#5C5B64" }}>
                Toca el cuadro para elegir una foto de tu galería (opcional)
              </span>
            </div>
          </div>

          <button
            onClick={addAnime}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              width: "100%",
              background: ACCENT,
              border: "none",
              borderRadius: 8,
              padding: "10px 14px",
              color: "#0B0B0F",
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700,
              fontSize: 16,
              textTransform: "uppercase",
              letterSpacing: "0.02em",
              cursor: "pointer",
            }}
          >
            <Plus size={18} strokeWidth={3} />
            Añadir a la lista
          </button>
        </div>

        {items.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "48px 16px",
              color: "#5C5B64",
              fontFamily: "Barlow, sans-serif",
              border: "1px dashed #232228",
              borderRadius: 14,
            }}
          >
            Tu lista está vacía. Añade tu primer anime arriba.
          </div>
        ) : (
          <ul
            ref={listRef}
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              WebkitUserSelect: "none",
              userSelect: "none",
              WebkitTouchCallout: "none",
            }}
          >
            {items.map((item, idx) => {
              const isDragging = dragId === item.id;
              const isOver = overId === item.id && dragId !== item.id;
              return (
                <li
                  key={item.id}
                  data-item-id={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    background: isOver ? ACCENT_SOFT : "#151419",
                    border: `1px solid ${isOver ? ACCENT : "#232228"}`,
                    borderRadius: 12,
                    padding: 10,
                    opacity: isDragging ? 0.5 : 1,
                    transition: isDragging ? "none" : "background 0.15s, border-color 0.15s, opacity 0.15s",
                    touchAction: "pan-y",
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontWeight: 900,
                      fontSize: 18,
                      color: idx < 3 ? ACCENT : "#5C5B64",
                    }}
                  >
                    {idx + 1}
                  </div>

                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 8,
                      overflow: "hidden",
                      flexShrink: 0,
                      background: "#0B0B0F",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1px solid #232228",
                    }}
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    ) : (
                      <ImageOff size={20} color="#3A3940" />
                    )}
                  </div>

                  <div
                    style={{
                      flex: 1,
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontWeight: 600,
                      fontSize: 18,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.name}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <button
                      onClick={() => moveByStep(item.id, -1)}
                      disabled={idx === 0}
                      aria-label="Subir"
                      style={arrowBtnStyle(idx === 0)}
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveByStep(item.id, 1)}
                      disabled={idx === items.length - 1}
                      aria-label="Bajar"
                      style={arrowBtnStyle(idx === items.length - 1)}
                    >
                      ▼
                    </button>
                  </div>

                  <div
                    onPointerDown={(e) => handlePointerDownOnGrip(e, item.id)}
                    onContextMenu={(e) => e.preventDefault()}
                    style={{
                      flexShrink: 0,
                      padding: 8,
                      margin: -8,
                      touchAction: "none",
                      cursor: "grab",
                      display: "flex",
                      WebkitUserSelect: "none",
                      userSelect: "none",
                      WebkitTouchCallout: "none",
                    }}
                  >
                    <GripVertical size={18} color={isDragging ? ACCENT : "#3A3940"} />
                  </div>

                  <button
                    onClick={() => removeAnime(item.id)}
                    aria-label="Eliminar"
                    style={{
                      background: "none",
                      border: "none",
                      color: "#5C5B64",
                      cursor: "pointer",
                      flexShrink: 0,
                      padding: 4,
                      display: "flex",
                    }}
                  >
                    <X size={18} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div
          style={{
            marginTop: 20,
            textAlign: "center",
            fontFamily: "Barlow, sans-serif",
            fontSize: 12,
            color: "#5C5B64",
          }}
        >
          {saveState === "saving" && "Guardando…"}
          {saveState === "saved" && "Lista guardada en este dispositivo"}
          {saveState === "error" && "No se pudo guardar"}
        </div>
      </div>
    </div>
  );
}

function arrowBtnStyle(disabled) {
  return {
    background: "none",
    border: "none",
    color: disabled ? "#2A2930" : "#8B8A94",
    cursor: disabled ? "default" : "pointer",
    fontSize: 10,
    lineHeight: 1,
    padding: 2,
  };
}
