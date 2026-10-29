"use client";
import { FormEvent, useState } from "react";
import { api, Lookups, Price, Product } from "../lib";
import { Modal } from "./ui";

export function ProductForm({
  item,
  lookups,
  onClose,
  onSaved,
}: {
  item: Product | null;
  lookups: Lookups;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [code, setCode] = useState(item?.Ma_SP ?? "");
  const [name, setName] = useState(item?.Ten_SP ?? "");
  const [type, setType] = useState(item?.Loai_SP ?? "MON_NUOC");
  const [description, setDescription] = useState(item?.Mo_ta ?? "");
  const [status, setStatus] = useState(item?.Trang_thai ?? "Đang bán");
  const [categories, setCategories] = useState<string[]>(
    item?.Danh_muc.map((c) => c.Ma_danh_muc) ?? [],
  );
  const [prices, setPrices] = useState<Price[]>(
    item?.Bang_gia ?? [{ Ma_size: "S", Gia_ban: 29000 }],
  );
  const [price, setPrice] = useState(String(item?.Don_gia ?? 29000));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!categories.length) {
      setError("Chọn ít nhất một danh mục.");
      return;
    }
    if (type === "MON_NUOC" && !prices.length) {
      setError("Món nước cần ít nhất một kích thước.");
      return;
    }
    setSaving(true);
    try {
      const result = await api<{ message: string }>(
        item ? `products/${item.Ma_SP}` : "products",
        {
          method: item ? "PUT" : "POST",
          body: JSON.stringify({
            Ma_SP: code,
            Ten_SP: name,
            Loai_SP: type,
            Mo_ta: description,
            Trang_thai: status,
            Danh_muc: categories,
            Bang_gia: type === "MON_NUOC" ? prices : [],
            Don_gia: type === "BANH_NGOT" ? Number(price) : null,
          }),
        },
      );
      onSaved(result.message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      title={item ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm mới"}
      onClose={() => {
        if (!saving) onClose();
      }}
    >
      <form onSubmit={submit}>
        <div className="modal-content form-stack">
          {error && (
            <div className="inline-warning" role="alert">
              {error}
            </div>
          )}
          <div className="form-row">
            <label>
              Mã sản phẩm *
              <input
                autoFocus={!item}
                required
                disabled={!!item}
                pattern="SP[0-9]{2,18}"
                maxLength={20}
                placeholder="VD: SP12"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                title="SP và từ 2 đến 18 chữ số"
              />
            </label>
            <label>
              Loại sản phẩm *
              <select
                disabled={!!item}
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="MON_NUOC">Món nước</option>
                <option value="BANH_NGOT">Bánh ngọt</option>
              </select>
            </label>
          </div>
          <label>
            Tên sản phẩm *
            <input
              autoFocus={!!item}
              required
              minLength={3}
              maxLength={150}
              placeholder="Nhập tên món trong thực đơn"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <fieldset>
            <legend>Danh mục *</legend>
            <div className="category-options">
              {lookups.categories.map((c) => (
                <label className="checkbox-label" key={c.Ma_danh_muc}>
                  <input
                    type="checkbox"
                    checked={categories.includes(c.Ma_danh_muc)}
                    onChange={(e) =>
                      setCategories(
                        e.target.checked
                          ? [...categories, c.Ma_danh_muc]
                          : categories.filter((x) => x !== c.Ma_danh_muc),
                      )
                    }
                  />
                  {c.Ten_danh_muc}
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            Mô tả
            <textarea
              rows={3}
              maxLength={500}
              placeholder="Hương vị, nguyên liệu..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          {type === "MON_NUOC" ? (
            <fieldset>
              <legend>Giá theo kích thước *</legend>
              <p className="subtle small">
                Giá từ 5.000 đồng; giá hóa đơn cũ được giữ nguyên.
              </p>
              <div className="size-price-grid">
                {lookups.sizes.map((s) => {
                  const selected = prices.find((p) => p.Ma_size === s.Ma_size);
                  return (
                    <div
                      className={`size-price ${selected ? "selected" : ""}`}
                      key={s.Ma_size}
                    >
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={!!selected}
                          onChange={(e) =>
                            setPrices(
                              e.target.checked
                                ? [
                                    ...prices,
                                    { Ma_size: s.Ma_size, Gia_ban: 29000 },
                                  ]
                                : prices.filter((p) => p.Ma_size !== s.Ma_size),
                            )
                          }
                        />
                        {s.Ma_size}
                      </label>
                      <input
                        aria-label={`Giá size ${s.Ma_size}`}
                        disabled={!selected}
                        required={!!selected}
                        type="number"
                        min="5000"
                        max="9999999999.99"
                        step="0.01"
                        value={selected?.Gia_ban ?? ""}
                        placeholder="Giá bán"
                        onChange={(e) =>
                          setPrices(
                            prices.map((p) =>
                              p.Ma_size === s.Ma_size
                                ? { ...p, Gia_ban: Number(e.target.value) }
                                : p,
                            ),
                          )
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </fieldset>
          ) : (
            <label>
              Giá bánh (VNĐ) *
              <input
                required
                type="number"
                min="5000"
                max="9999999999.99"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
              <span className="subtle small">
                Bánh có giá cố định, không chọn size hoặc topping.
              </span>
            </label>
          )}
          <label>
            Trạng thái bán
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {["Đang bán", "Hết hàng", "Ngừng kinh doanh"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="modal-footer">
          <span className="subtle small">* Thông tin bắt buộc</span>
          <button
            type="button"
            className="button secondary"
            disabled={saving}
            onClick={onClose}
          >
            Hủy
          </button>
          <button className="button primary" disabled={saving}>
            {saving ? "Đang lưu..." : item ? "Lưu thay đổi" : "Thêm sản phẩm"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
