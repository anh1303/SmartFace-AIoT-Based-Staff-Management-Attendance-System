import React from 'react';
import { ScanFace, Camera, Upload, Layers, Plus, Trash2, Check } from 'lucide-react';

export interface FacePhotoItem {
  id: string;
  url: string;
  name: string;
  tag: string;
}

interface FaceEnrollmentSectionProps {
  uploadedPhotos: FacePhotoItem[];
  analyzingFace: boolean;
  disabled?: boolean;
  onOpenEkycModal: () => void;
  onPhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePhoto: (id: string) => void;
  onOpenConfirmModal: () => void;
}

export const FaceEnrollmentSection: React.FC<FaceEnrollmentSectionProps> = ({
  uploadedPhotos,
  analyzingFace,
  disabled = false,
  onOpenEkycModal,
  onPhotoUpload,
  onRemovePhoto,
  onOpenConfirmModal,
}) => {
  return (
    <div className="space-y-5">
      {/* Header Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200/80 dark:border-[#21264b]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700/50 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
            <ScanFace className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">
              Cập Nhật Dữ Liệu Khuôn Mặt
            </h3>
          </div>
        </div>

        <button
          type="button"
          disabled={disabled || analyzingFace}
          onClick={onOpenEkycModal}
          className={`px-4 py-2.5 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
            disabled
              ? 'bg-slate-300 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-60'
              : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-sm shadow-purple-600/20 hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
          }`}
          title={disabled ? 'Không thể tự cập nhật dữ liệu nhận diện của bản thân' : undefined}
        >
          <Camera className="w-4 h-4 text-purple-200" />
          <span>Chụp bằng Camera</span>
        </button>
      </div>

      {/* Upload Area / Photos Gallery */}
      {uploadedPhotos.length === 0 ? (
        <div className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          disabled
            ? 'border-slate-200 dark:border-slate-800 bg-slate-100/40 dark:bg-[#0a0c16]/40 opacity-60 cursor-not-allowed'
            : 'border-slate-300 dark:border-slate-700 hover:border-purple-500 dark:hover:border-purple-500 cursor-pointer bg-slate-50/50 dark:bg-[#0f1224]/50 group'
        }`}>
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={disabled || analyzingFace}
            onChange={onPhotoUpload}
            className={`absolute inset-0 opacity-0 w-full h-full z-10 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          />
          <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700/50 mx-auto flex items-center justify-center text-purple-600 dark:text-purple-400 mb-3 group-hover:scale-110 transition-transform">
            <Upload className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            Kéo thả ảnh vào đây hoặc bấm để chọn tệp
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Tối thiểu 3 ảnh các góc (Chính diện, Quay trái, Quay phải)
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              Danh sách ảnh mẫu ({uploadedPhotos.length} ảnh):
            </span>
            <label className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1d2243] border border-slate-200 dark:border-[#272d5a] text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors">
              <Plus className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Thêm ảnh</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={onPhotoUpload}
                className="hidden"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {uploadedPhotos.map((photo, idx) => (
              <div
                key={photo.id}
                className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-[#21264b] bg-white dark:bg-[#0f1224] group shadow-xs"
              >
                <div className="aspect-[4/3] bg-slate-100 dark:bg-[#0b0d19] relative">
                  <img
                    src={photo.url}
                    alt={photo.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/75 text-[10px] font-mono font-bold text-white">
                    #{idx + 1}
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemovePhoto(photo.id)}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-xs"
                    title="Xóa ảnh này"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="p-2 text-center bg-white dark:bg-[#0f1224] border-t border-slate-100 dark:border-[#21264b]">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                    {photo.tag || `Ảnh ${idx + 1}`}
                  </p>
                </div>
              </div>
            ))}

            {/* Add more photo card */}
            <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-purple-400 dark:hover:border-purple-500 rounded-xl flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-colors bg-slate-50/40 hover:bg-slate-100 dark:bg-[#0f1224]/40 dark:hover:bg-[#0f1224] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 min-h-[130px]">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={onPhotoUpload}
                className="hidden"
              />
              <Plus className="w-6 h-6 mb-1 text-slate-400" />
              <span className="text-xs font-medium">Thêm ảnh</span>
            </label>
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="pt-4 border-t border-slate-100 dark:border-[#21264b] flex items-center justify-between">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {uploadedPhotos.length < 3 ? (
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              Cần tối thiểu 3 ảnh để cập nhật ({uploadedPhotos.length}/3)
            </span>
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              Đã đủ {uploadedPhotos.length} ảnh hợp lệ
            </span>
          )}
        </span>

        <button
          type="button"
          disabled={disabled || uploadedPhotos.length < 3 || analyzingFace}
          onClick={onOpenConfirmModal}
          className={`px-6 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all ${
            uploadedPhotos.length >= 3 && !analyzingFace && !disabled
              ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm shadow-purple-600/20 cursor-pointer'
              : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
          }`}
        >
          <Check className="w-4 h-4" />
          <span>Xác nhận & Cập nhật Sinh trắc Khuôn mặt</span>
        </button>
      </div>
    </div>
  );
};
