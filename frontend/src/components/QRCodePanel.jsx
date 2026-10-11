import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Smartphone, QrCode, ExternalLink, Copy, Check,
  Radio, RefreshCw, Wifi, CheckCircle2
} from 'lucide-react';

export default function QRCodePanel({
  telemetry,
  pointCloudData,
  onOpenMobileView
}) {
  const [networkInfo, setNetworkInfo] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [useHttps, setUseHttps] = useState(true);

  const host = typeof window !== 'undefined' ? window.location.host : '127.0.0.1:5173';
  const API_BASE = typeof window !== 'undefined' ? `${window.location.protocol}//${host}` : 'http://127.0.0.1:8000';

  const fetchNetInfo = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/network_info`);
      if (res.ok) {
        const data = await res.json();
        setNetworkInfo(data);
        const targetUrl = (data.phone_https_url && useHttps) ? data.phone_https_url : data.phone_http_url;
        generateQR(targetUrl);
        return;
      }
    } catch (err) {
      console.warn('Network info fetch error:', err);
    }

    const fallbackIp = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
    generateQR(`http://${fallbackIp}:5173/phone`);
  };

  useEffect(() => {
    fetchNetInfo();
  }, [API_BASE, useHttps]);

  const generateQR = async (targetUrl) => {
    if (!targetUrl) return;
    setLoading(true);
    try {
      // High-contrast pure black modules on pure white background
      // standard margin 2 ensures 100% instant recognition by all iOS and Android camera apps
      const qr = await QRCode.toDataURL(targetUrl, {
        width: 300,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      setQrDataUrl(qr);
    } catch (e) {
      console.error('Failed to generate QR code:', e);
    } finally {
      setLoading(false);
    }
  };

  const hasHttps = Boolean(networkInfo?.phone_https_url);
  const activePhoneUrl = (hasHttps && useHttps)
    ? networkInfo.phone_https_url
    : (networkInfo?.phone_http_url || `http://${networkInfo?.local_ip || '127.0.0.1'}:5173/phone`);

  const handleCopy = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(activePhoneUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const totalPoints = pointCloudData?.total_points || (pointCloudData?.positions ? Math.floor(pointCloudData.positions.length / 3) : 0);
  const isActuallyStreaming = totalPoints > 0 || (telemetry?.frame_count > 0 && telemetry?.motion_state !== 'INITIALIZING');


  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: '24px 20px',
      gap: '16px',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      color: '#f8fafc',
      position: 'relative'
    }}>
      {/* Title */}
      <div>
        <h2 style={{
          fontSize: '1.25rem',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}>
          <Smartphone size={22} color="#00d2ff" />
          Scan With Phone
        </h2>
        <p style={{
          fontSize: '0.78rem',
          color: '#94a3b8',
          marginTop: '6px',
          maxWidth: '280px',
          lineHeight: 1.45
        }}>
          Scan with your phone's default camera app to stream and replicate your room in 3D.
        </p>

        {/* Mode Selector: HTTPS (Secure for Camera) vs Wi-Fi LAN */}
        {hasHttps && (
          <div style={{
            display: 'inline-flex',
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '10px',
            padding: '3px',
            marginTop: '8px',
            gap: '4px'
          }}>
            <button
              onClick={() => setUseHttps(true)}
              style={{
                background: useHttps ? 'linear-gradient(135deg, #00d2ff 0%, #0077ff 100%)' : 'transparent',
                color: useHttps ? '#07090e' : '#94a3b8',
                border: 'none',
                borderRadius: '8px',
                padding: '5px 10px',
                fontSize: '0.7rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              🔒 Secure HTTPS (Live Camera)
            </button>
            <button
              onClick={() => setUseHttps(false)}
              style={{
                background: !useHttps ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                color: !useHttps ? '#fff' : '#94a3b8',
                border: 'none',
                borderRadius: '8px',
                padding: '5px 10px',
                fontSize: '0.7rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              📡 Wi-Fi LAN (HTTP)
            </button>
          </div>
        )}
      </div>

      {/* High-Contrast Scannable QR Code Card - ALWAYS UNOBSTRUCTED */}
      <div style={{
        background: '#ffffff',
        padding: '14px',
        borderRadius: '16px',
        boxShadow: '0 10px 35px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.2)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
      }}>
        {loading || !qrDataUrl ? (
          <div style={{
            width: '240px',
            height: '240px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            color: '#070a12'
          }}>
            <RefreshCw size={28} className="spin" color="#00d2ff" />
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Generating QR...</span>
          </div>
        ) : (
          <img
            src={qrDataUrl}
            alt={`Scan with phone: ${activePhoneUrl}`}
            style={{
              width: '240px',
              height: '240px',
              display: 'block',
              imageRendering: 'pixelated'
            }}
          />
        )}
      </div>

      {/* Stream Status (placed BELOW the QR code so it never obscures scanning) */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 14px',
        borderRadius: '999px',
        background: isActuallyStreaming ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0, 210, 255, 0.1)',
        border: `1px solid ${isActuallyStreaming ? 'rgba(16, 185, 129, 0.4)' : 'rgba(0, 210, 255, 0.3)'}`,
        fontSize: '0.72rem',
        fontWeight: 700,
        color: isActuallyStreaming ? '#10b981' : '#00d2ff'
      }}>
        <Radio size={13} className={isActuallyStreaming ? 'pulse' : ''} />
        {isActuallyStreaming
          ? `Phone Streaming (${totalPoints.toLocaleString()} points)`
          : 'Ready for Camera Scan'}
      </div>

      {/* URL Link and Copy Action */}
      <div style={{
        width: '100%',
        maxWidth: '320px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(0, 210, 255, 0.25)',
          borderRadius: '10px',
          padding: '8px 12px',
          fontSize: '0.75rem'
        }}>
          <span style={{
            fontFamily: 'monospace',
            color: '#38bdf8',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {activePhoneUrl}
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={handleCopy}
              title="Copy URL"
              style={{
                background: copied ? '#10b981' : 'rgba(255,255,255,0.08)',
                border: 'none',
                borderRadius: '6px',
                padding: '5px 8px',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.7rem',
                fontWeight: 600
              }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <a
              href={activePhoneUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in new window"
              style={{
                background: 'rgba(255,255,255,0.08)',
                borderRadius: '6px',
                padding: '5px 7px',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <ExternalLink size={12} />
            </a>
          </div>
        </div>

        {/* Quick Launch Mobile View (for local desktop webcam or testing) */}
        {onOpenMobileView && (
          <button
            onClick={onOpenMobileView}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(0, 210, 255, 0.3)',
              background: 'rgba(0, 210, 255, 0.08)',
              color: '#00d2ff',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <Smartphone size={14} /> Open Scanner On This Device
          </button>
        )}
      </div>

      {/* Helpful Hint for ngrok */}
      {useHttps && hasHttps && (
        <div style={{
          fontSize: '0.68rem',
          color: '#94a3b8',
          maxWidth: '290px',
          lineHeight: 1.4,
          background: 'rgba(0, 210, 255, 0.06)',
          border: '1px solid rgba(0, 210, 255, 0.2)',
          borderRadius: '8px',
          padding: '6px 10px'
        }}>
          💡 <strong>Tip on phone:</strong> If the ngrok security screen appears, tap <strong>"Visit Site"</strong> once to open the live camera feed.
        </div>
      )}


      {/* Network notice */}
      <div style={{
        fontSize: '0.68rem',
        color: '#64748b',
        maxWidth: '280px',
        lineHeight: 1.4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '5px'
      }}>
        <Wifi size={12} color="#00d2ff" />
        <span>Phone & computer must be on the same Wi-Fi.</span>
      </div>
    </div>
  );
}
