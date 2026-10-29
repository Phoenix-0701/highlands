"use client";
import { useEffect, useState } from "react";
import { api, date, Lookups, LoyaltyData, Voucher } from "../lib";
import { Badge, Empty, Icon, Modal } from "./ui";

export function Loyalty({
  connected,
  refresh,
  lookups,
  onChanged,
}: {
  connected: boolean;
  refresh: number;
  lookups: Lookups;
  onChanged: (m: string) => void;
}) {
  const [customer, setCustomer] = useState("KH01"),
    [data, setData] = useState<LoyaltyData>({ vouchers: [], history: [] });
  const [pending, setPending] = useState<Voucher | null>(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const selected = lookups.customers.find((k) => k.Ma_KH === customer);
  useEffect(() => {
    let active = true;
    if (connected) {
      setLoading(true);
      setData({ vouchers: [], history: [] });
      api<LoyaltyData>(`loyalty/${encodeURIComponent(customer)}`)
        .then((x) => {
          if (active) setData(x);
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [connected, customer, refresh]);
  async function redeem() {
    if (!pending) return;
    setBusy(true);
    setError("");
    try {
      const r = await api<{ message: string }>("loyalty/redeem", {
        method: "POST",
        body: JSON.stringify({ customer, voucher: pending.Ma_Voucher }),
      });
      setPending(null);
      onChanged(r.message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {error && !pending && (
        <div className="inline-warning" role="alert">
          {error}
        </div>
      )}
      <div className="loyalty-heading">
        <label>
          Khách hàng
          <select
            value={customer}
            onChange={(e) => {
              setCustomer(e.target.value);
              setError("");
            }}
          >
            {lookups.customers.map((k) => (
              <option key={k.Ma_KH} value={k.Ma_KH}>
                {k.Ho} {k.Ten} · {k.Ma_KH}
              </option>
            ))}
          </select>
        </label>
        <div className="points-summary">
          <span>SỐ DƯ ĐIỂM</span>
          <strong>
            {selected?.Diem_tich_luy ?? "—"} <small>Drips</small>
          </strong>
          <span>{selected?.Hang_thanh_vien ?? ""}</span>
        </div>
        <p>
          Điểm đổi voucher được trừ trong một giao dịch.
          <br />
          Hạn sử dụng được tính từ ngày đổi.
        </p>
      </div>
      <section className="panel">
        <div className="section-title">
          <div>
            <h2>Đổi một chút điểm, thêm nhiều niềm vui</h2>
            <p>Chọn ưu đãi cho lần ghé Highlands tiếp theo.</p>
          </div>
        </div>
        <div className="voucher-grid">
          {lookups.vouchers.map((v) => (
            <div className="voucher-card" key={v.Ma_Voucher}>
              <div className="voucher-symbol">
                <Icon name="loyalty" size={28} />
              </div>
              <span className="eyebrow">
                {v.Ma_Voucher} · {v.Tgian_hieu_luc} NGÀY
              </span>
              <h3>{v.Ten_Voucher}</h3>
              <div>
                <strong>{v.Diem_doi} Drips</strong>
                <button
                  className="button secondary"
                  disabled={busy || !connected}
                  onClick={() => {
                    setError("");
                    setPending(v);
                  }}
                >
                  Đổi voucher
                  <Icon name="arrow" size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
      <div className="two-column">
        <section className="panel">
          <div className="section-title">
            <h2>Ví voucher cá nhân</h2>
          </div>
          {loading ? (
            <Empty>Đang tải ví voucher...</Empty>
          ) : data.vouchers.length ? (
            data.vouchers.map((v) => (
              <div className="wallet-row" key={v.Ma_VCCN}>
                <Icon name="loyalty" />
                <div>
                  <strong>{v.Ten_Voucher}</strong>
                  <span className="cell-note">
                    {v.Ma_VCCN} · HSD {date(v.HSD)}
                  </span>
                </div>
                <Badge
                  value={
                    v.Trang_thai === "CHUA_SU_DUNG" &&
                    new Date(v.HSD) < new Date()
                      ? "HET_HAN"
                      : v.Trang_thai
                  }
                />
              </div>
            ))
          ) : (
            <Empty>Khách hàng chưa có voucher.</Empty>
          )}
        </section>
        <section className="panel">
          <div className="section-title">
            <h2>Lịch sử biến động điểm</h2>
          </div>
          {loading ? (
            <Empty>Đang tải lịch sử...</Empty>
          ) : data.history.length ? (
            data.history.map((h) => (
              <div className="history-row" key={h.Ma_LS}>
                <div>
                  <strong>{h.Noi_dung}</strong>
                  <span className="cell-note">
                    {date(h.Thoi_gian)} · {h.Ma_LS}
                  </span>
                </div>
                <strong
                  className={h.Diem_thay_doi > 0 ? "positive" : "danger-text"}
                >
                  {h.Diem_thay_doi > 0 ? "+" : ""}
                  {h.Diem_thay_doi}
                </strong>
              </div>
            ))
          ) : (
            <Empty>Chưa có biến động điểm.</Empty>
          )}
        </section>
      </div>
      {pending && (
        <Modal
          title="Xác nhận đổi voucher"
          onClose={() => {
            if (!busy) setPending(null);
          }}
        >
          <div className="modal-content">
            <p>
              Đổi <strong>{pending.Diem_doi} Drips</strong> lấy{" "}
              <strong>{pending.Ten_Voucher}</strong> cho {selected?.Ho}{" "}
              {selected?.Ten}?
            </p>
            <p className="subtle">
              Số dư: {selected?.Diem_tich_luy} Drips. Hiệu lực{" "}
              {pending.Tgian_hieu_luc} ngày kể từ lúc đổi.
            </p>
            {error && (
              <div className="inline-warning" role="alert">
                {error}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setPending(null)}
            >
              Quay lại
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void redeem()}
            >
              {busy ? "Đang xử lý..." : "Xác nhận đổi"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
