"use client";

import { type ChangeEvent, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { checkUsernameAction, guestLoginAction, loginAction } from "@/app/actions/auth";
import type { LoginDesignType } from "@/services/systemSettingsService";
import { Mars, Venus, ShieldCheck, Eye, EyeOff, Mic, User } from "lucide-react";

type StatusState =
  | { type: "idle"; message?: string }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

type InfoModalType = "privacy" | "rules" | "info" | null;

interface LoginFormProps {
  variant?: LoginDesignType;
  compact?: boolean;
  forceLightMode?: boolean;
  hideHeader?: boolean;
  hideFooter?: boolean;
  submitLabel?: string;
}

const LoginForm = ({
  variant = "standard",
  compact = false,
  forceLightMode = false,
  hideHeader = false,
  hideFooter = false,
  submitLabel,
}: LoginFormProps) => {
  const router = useRouter();
  const isPremium = variant === "premium";
  const [rumuz, setRumuz] = useState("");
  const [password, setPassword] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [agentNickname, setAgentNickname] = useState("");
  const [existingUsername, setExistingUsername] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusState>({ type: "idle" });
  const [isPending, startTransition] = useTransition();
  const [showPasswordValue, setShowPasswordValue] = useState(false);
  const [activeInfoModal, setActiveInfoModal] = useState<InfoModalType>(null);
  const [isEnteringChat, setIsEnteringChat] = useState(false);

  const handleUsernameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (value.length <= 15) {
      setRumuz(value);
    }
  };

  const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
  };

  const enterChatWithLoading = () => {
    setIsEnteringChat(true);

    setTimeout(() => {
      setShowPasswordModal(false);
      router.replace("/chat/lobby");
    }, 1800);
  };

  const handleUsernameSubmit = async () => {
    if (!gender) {
      setStatus({
        type: "error",
        message: "Lütfen cinsiyet seçiniz.",
      });
      return;
    }

    startTransition(async () => {
      setStatus({ type: "idle" });
      const result = await checkUsernameAction(rumuz);

      if (result.success) {
        if (result.available === false) {
          setExistingUsername(result.existingUsername || null);
          setShowPasswordModal(true);
        } else {
          try {
            const result = await guestLoginAction(rumuz, gender);
            if (!result.success) {
              throw new Error(result.error || "Misafir girişi başarısız.");
            }

            if (result.accessToken) {
              localStorage.setItem("accessToken", result.accessToken);
              const maxAge = 60 * 60 * 24;
              document.cookie = `auth_token=${result.accessToken}; path=/; max-age=${maxAge}; samesite=Lax`;
            }
            localStorage.setItem("isGuest", "true");
            localStorage.setItem("guestUsername", result.username || rumuz);
            localStorage.removeItem("profileJoinEffect");
            localStorage.removeItem("agentNickname");
            localStorage.removeItem("agentSession");
            if (result.id) {
              localStorage.setItem("userId", String(result.id));
            }
            if (result.loginHistoryId) {
              localStorage.setItem(
                "loginHistoryId",
                String(result.loginHistoryId),
              );
            } else {
              localStorage.removeItem("loginHistoryId");
            }
            localStorage.removeItem("username");
            localStorage.setItem("guestGender", gender);
            enterChatWithLoading();
          } catch (error) {
            setStatus({
              type: "error",
              message: (error as Error)?.message || "Misafir girişi başarısız.",
            });
          }
        }
      } else {
        setStatus({
          type: "error",
          message: result.error || "Bir hata oluştu.",
        });
      }
    });
  };

  const handleLoginSubmit = async () => {
    startTransition(async () => {
      setStatus({ type: "idle" });

      const usernameToUse = existingUsername || rumuz;
      const result = await loginAction(
        usernameToUse,
        password,
        agentNickname.trim() || undefined,
      );

      if (result.success && result.data) {
        setStatus({
          type: "success",
          message: "Giriş başarılı! Yönlendiriliyorsunuz...",
        });

        if (result.data.accessToken) {
          localStorage.setItem("accessToken", result.data.accessToken);
          const maxAge = 60 * 60 * 24 * 7;
          document.cookie = `auth_token=${result.data.accessToken}; path=/; max-age=${maxAge}; samesite=Lax`;
        }

        if (result.data.username) {
          localStorage.setItem("username", result.data.username);
        }
        if (result.data.id) {
          localStorage.setItem("userId", result.data.id);
        }
        if (result.data.loginHistoryId) {
          localStorage.setItem(
            "loginHistoryId",
            String(result.data.loginHistoryId),
          );
        } else {
          localStorage.removeItem("loginHistoryId");
        }
        localStorage.setItem("isGuest", "false");
        localStorage.removeItem("guestUsername");
        localStorage.removeItem("guestGender");
        localStorage.removeItem("guestStatusModeId");
        localStorage.removeItem("guestStatusModeName");
        localStorage.removeItem("guestStatusModeExpiresAt");

        if (agentNickname.trim()) {
          localStorage.setItem("agentNickname", agentNickname.trim());
          localStorage.setItem("agentSession", "true");
        } else {
          localStorage.removeItem("agentNickname");
          localStorage.removeItem("agentSession");
        }

        enterChatWithLoading();
      } else {
        setStatus({
          type: "error",
          message: result.error || "Bir hata oluştu.",
        });
      }
    });
  };

  const inputClassName = isPremium
    ? `w-full rounded-2xl border border-[#ffe8a3]/70 bg-white/82 px-4 ${compact ? "py-2.5" : "py-3"} text-[#071b3d] placeholder:text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl transition-all focus:border-[#fff6d1] focus:outline-none focus:ring-2 focus:ring-[#fff6d1]/40`
    : `w-full rounded-2xl border border-white/10 bg-white/[0.055] px-4 pl-11 ${compact ? "py-3.5" : "py-4"} text-slate-100 placeholder:text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition-all hover:border-white/15 focus:border-cyan-300/45 focus:bg-white/[0.075] focus:ring-4 focus:ring-cyan-400/10`;
  const labelClassName = isPremium
    ? "mb-2 block text-sm font-semibold text-[#071b3d]"
    : "mb-2 block text-sm font-bold text-slate-300";
  const counterClassName = isPremium
    ? "absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-black"
    : "absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-600";
  const primaryButtonClassName = isPremium
    ? `premium-liquid-button w-full rounded-2xl px-4 ${compact ? "py-3 text-[15px]" : "py-3"} font-extrabold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-60 active:scale-95`
    : `w-full rounded-2xl border border-violet-300/20 bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-600 px-6 ${compact ? "py-3.5 text-[15px]" : "py-4"} font-black text-white shadow-[0_16px_38px_rgba(37,99,235,0.28)] transition-all hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 active:translate-y-0 active:scale-[0.99]`;
  const secondaryButtonClassName = isPremium
    ? "flex-1 rounded-2xl border border-[#ffe8a3]/75 bg-white/72 px-4 py-3 font-semibold text-[#071b3d] backdrop-blur-xl transition-all hover:bg-[#fff6d1]/45 active:scale-95"
    : "flex-1 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 font-bold text-slate-300 transition-all hover:border-white/20 hover:bg-white/[0.08] active:scale-[0.99]";
  const errorClassName = isPremium ? "text-rose-500" : "text-rose-400";
  const helperClassName = isPremium ? "text-[#071b3d]/70" : "text-slate-500";
  const modalTitleClassName = isPremium
    ? "text-2xl font-bold text-white flex items-center justify-center gap-2"
    : "mb-4 text-xl font-black text-white";
  const footerNavClassName = isPremium
    ? "mt-8 border-t border-white/10 pt-5 text-amber-100/70"
    : "mt-5 border-t border-white/10 pt-4 text-slate-500";
  const footerNavItemClassName = isPremium
    ? "text-sm font-medium transition-colors hover:text-amber-300"
    : "text-xs font-bold text-slate-500 transition-colors hover:text-cyan-300";
  const infoModalOverlayClassName =
    "fixed inset-0 z-50 flex items-start justify-center bg-black/35 px-4 pt-24 backdrop-blur-[2px] sm:pt-28";
  const infoModalCardClassName =
    "w-full max-w-sm rounded-2xl bg-white px-4 py-4 text-zinc-700 shadow-[0_20px_60px_rgba(0,0,0,0.24)] sm:max-w-md sm:px-5 sm:py-5";
  const infoModalButtonClassName =
    "mx-auto mt-4 block rounded-xl bg-black px-4 py-2 text-sm font-semibold text-[#fff6d1] shadow-[0_0_0_3px_rgba(255,246,209,0.22)] transition-colors hover:bg-[#071b3d]";

  const infoModalContent = {
    privacy: {
      title: "Gizlilik",
      body: (
        <>
          <p>
            Servislerimizi kullanmak için BAĞLAN butonuna tıklayıp giriş
            yaptığınız/yapamadığınız andan itibaren aşağıda listelenen maddeleri
            sitesi için bütünüyle kabul etmiş olacaksınız; eğer kabul
            etmiyorsanız, hür iradenizle sitemizden hemen şimdi AYRILIN.
          </p>
          <p className="mt-6">
            T.C. Yasalarında var olan bütün hükümler doğrudan ve olduğu gibi
            servislerimizin kullanımı için de geçerlidir. Sizi tanımamız, sizi
            korumamız ve kendi güvenliğimizi idame etmemiz için kullandığınız
            tarayıcı (browser) teknolojisi ve İZNİNİZ dahilinde ve ÖZEL OLMAYAN
            bilgi/cookie/tarayıcı yeteneklerini/IP adresini alıyoruz. ALINAN
            BİLGİLERİ AŞAĞIDA LİSTELEDİK:
          </p>
          <div className="mt-6 space-y-4">
            <p>
              <strong>IP Adresiniz:</strong> 5651 Sayılı İnternet Yasası
              Gereğince alınmaktadır. 123.123.123.123 gibi sayılar içerir. 1-2
              dakika sonra aynı adresi başkası da kullanılabilir ve şahsınıza
              özel bilgi değildir.
            </p>
            <p>
              <strong>Telefon mu, bilgisayar mı?:</strong> Giriş yaptığınızda
              size uygun tasarımı göstermek için kullanıyoruz. Telefon ya da
              bilgisayar olup olmadığını söyler, şahsınıza özel bilgi değildir.
            </p>
            <p>
              <strong>Ekran çözünürlüğünüz:</strong> Size uygun ekran boyutunu
              ve tasarımı sunmak maksatlı alınmaktadır. 360, 420 gibi sayıları
              içerir, özel bilgi değildir.
            </p>
            <p>
              <strong>Tarayıcı üst bilgisi:</strong> İsteseniz de istemeseniz de
              her girdiğiniz siteye mecburen verdiğiniz bilgidir, bir sürü
              manasız ve ilginizi çekmeyen ÖZEL OLMAYAN teknik bilgiler içerir.
              Örneğin; kullandığınız tarayıcının Chrome&apos;u mu yoksa Explorer
              mı olduğunu anlamak için kullanılır, bu sayede ses yayına
              girebilir veya giremezsiniz. Bu da özel bilgi değildir.
            </p>
            <p>
              <strong>Cookie / Çerez:</strong> Sitemizi daha önce ziyaret edip
              etmediğinizi anlamamıza yarayan teknolojik bir yetenektir. Bunu da
              aynı şekilde Kullanıcı Girişi olan her türlü siteyle paylaşmak
              ZORUNDASINIZ. Ayrıca bu da özel bilgi değildir ve özel
              bilgilerinizi içermez.
            </p>
            <p>
              Söz konusu bilgiler, ziyaret ettiğiniz bütün İnternet sitelerinin
              de aldığı ve alabileceği bilgilerdir. Bizim farkımız ise, yasalara
              uygun olarak bu bilgileri sadece güvenliğinizi sağlamak maksatlı
              temin ettiğimizi size detaylı bir şekilde söylememizdir.
            </p>
            <p>
              Ayrıca bu bilgilerin hiçbiri ÖZEL bilgileriniz değildir, standart
              ve anonim bilgilerdir. Kısacası endişelenmenize gerek yoktur. Buna
              rağmen hâlâ endişeleriniz varsa lütfen servislerimize
              bağlanmayınız.
            </p>
            <p>
              T.C. Yasalarına göre suç teşkil edebilecek/eden hiçbir unsuru
              servislerimizi kullanırken gerçekleştiremezsiniz, böylesi bir
              durumda sorumluluk tamamen size ait olduğu gibi, servislerimizden
              uzaklaştırılacak ve gerekirse hakkınızda yasal işlemlerin
              başlatılması için gerekli adli mercilere başvurmamız gizli kalmak
              kaydıyla verileriniz tarafımızca da hıfz edilecektir.
            </p>
            <p>
              Sistemde var olan bütün hareketleriniz, tarafımızca IP adresiniz
              ve işlem saati ile beraber kayıt altına alınır. Tarafımızca
              yasalar gereği kayıt altına alınan her türlü bilgiyi,
              istenildiğinde resmi makamlara iletmekle yükümlüyüz.
            </p>
            <p>
              Servislerimizi kullanırken kendi orijinal IP adresinizi
              kullanabilirsiniz, Proxy IP (sahte/vekil ip) kullanan tespit
              edildiğinde direkt olarak uzaklaştırılacaktır.
            </p>
          </div>
        </>
      ),
    },
    rules: {
      title: "Kurallar",
      body: (
        <ol className="list-decimal space-y-1 pl-8">
          <li>T.C. yasalarinin tamamina site icerisinde uymak.</li>
          <li>Evrensel ahlak kurallarini cignememek.</li>
          <li>Hakaret, kufur, rencide edici davranislardan uzak durmak.</li>
          <li>Farkli internet sitelerinin reklamini yapmamak.</li>
          <li>Irk, din, dil, cinsiyet ayrimi yapmamak.</li>
          <li>Pornometin, pornografik veya pornoses paylasimlar yapmamak.</li>
          <li>
            Sistemden uzaklastirildigin da ILE DE GELECEGIM mantigindan uzak
            durup, ceza suresinin bitmesini beklemek.
          </li>
        </ol>
      ),
    },
    info: {
      title: "Bilgilendirme",
      body: (
        <div className="space-y-1">
          <p>
            ► Android ve iOS telefonlar, TV, tablet ve bilgisayarlardan giriş
            yapılabilmektedir.
          </p>
          <p>
            ► Explorer tarayıcısı ses ve kamera sistemini desteklemez. Tavsiye
            edilen tarayıcılar: Google Chrome, Mozilla Firefox ve Opera.
          </p>
          <p>► Sitemize üye olmadan da giriş yapabilirsiniz.</p>
        </div>
      ),
    },
  } as const;

  const currentInfoModal = activeInfoModal
    ? infoModalContent[activeInfoModal]
    : null;

  const enteringChatOverlay = (
    <div className="fixed inset-0 z-[9999] flex min-h-screen items-center justify-center overflow-hidden bg-[#08090d] px-5 py-8 text-white">
      <div className="absolute inset-0 bg-[linear-gradient(160deg,#050609_0%,#10131d_45%,#050609_100%)]" />
      <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="absolute left-1/2 top-[44%] h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300/10 blur-3xl sm:h-[520px] sm:w-[520px]" />
      <div className="absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-black to-transparent" />

      <div className="relative w-full max-w-[430px] rounded-[30px] bg-gradient-to-br from-amber-200/70 via-white/16 to-sky-200/35 p-px shadow-[0_28px_90px_rgba(0,0,0,0.62)]">
        <div className="relative overflow-hidden rounded-[29px] border border-black/40 bg-[#0c1018]/95 px-5 py-7 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.10)] sm:px-8 sm:py-9">
          <div className="absolute left-5 top-5 h-7 w-7 border-l border-t border-amber-200/60" />
          <div className="absolute right-5 top-5 h-7 w-7 border-r border-t border-amber-200/60" />
          <div className="absolute bottom-5 left-5 h-7 w-7 border-b border-l border-amber-200/35" />
          <div className="absolute bottom-5 right-5 h-7 w-7 border-b border-r border-amber-200/35" />
          <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/55 to-transparent" />

          <div className="relative mx-auto mb-7 flex h-24 w-24 items-center justify-center rounded-[26px] border border-white/10 bg-[#111827] shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_18px_48px_rgba(0,0,0,0.36)] sm:h-28 sm:w-28">
            <div className="absolute inset-2 rounded-[22px] border border-amber-200/18" />
            <div className="absolute h-16 w-16 animate-spin rounded-full border-[3px] border-white/10 border-t-amber-300 sm:h-20 sm:w-20" />
            <Mic className="relative h-9 w-9 text-amber-100 drop-shadow-[0_0_16px_rgba(251,191,36,0.55)] sm:h-10 sm:w-10" />
          </div>

          <div className="relative">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.32em] text-amber-200/70">
              Live voice
            </p>
            <h1 className="text-[clamp(2.35rem,11vw,4.65rem)] font-black leading-none text-[#f9fafb] drop-shadow-[0_14px_28px_rgba(0,0,0,0.45)]">
              KingMobile
            </h1>
            <div className="mx-auto mt-3 h-px w-28 bg-gradient-to-r from-transparent via-amber-200/85 to-transparent" />
            <p className="mx-auto mt-5 max-w-xs text-[15px] font-semibold leading-6 text-zinc-200 sm:text-lg">
              Sesli sohbete bağlanılıyor...
            </p>
          </div>

          <div className="mx-auto mt-8 flex h-12 max-w-[250px] items-end justify-center gap-1.5 rounded-2xl border border-white/10 bg-black/28 px-5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <span className="h-4 w-1 animate-pulse rounded-full bg-amber-200" />
            <span className="h-7 w-1 animate-pulse rounded-full bg-zinc-100 [animation-delay:90ms]" />
            <span className="h-5 w-1 animate-pulse rounded-full bg-amber-300 [animation-delay:180ms]" />
            <span className="h-9 w-1 animate-pulse rounded-full bg-zinc-50 [animation-delay:270ms]" />
            <span className="h-6 w-1 animate-pulse rounded-full bg-amber-300 [animation-delay:360ms]" />
            <span className="h-8 w-1 animate-pulse rounded-full bg-zinc-100 [animation-delay:450ms]" />
            <span className="h-4 w-1 animate-pulse rounded-full bg-amber-200 [animation-delay:540ms]" />
          </div>

          <div className="mx-auto mt-7 h-1.5 max-w-[280px] overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-amber-300 via-amber-100 to-white shadow-[0_0_16px_rgba(251,191,36,0.35)]" />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={`w-full flex flex-col ${compact ? "min-h-0" : "min-h-[380px]"}`}
    >
      {isEnteringChat && typeof document !== "undefined"
        ? createPortal(enteringChatOverlay, document.body)
        : null}

      {isPremium && !hideHeader && (
        <div className="mb-10 text-center animate-in fade-in duration-700">
          <h3 className={modalTitleClassName}>
            <ShieldCheck className="h-6 w-6 text-amber-500" />
            Giriş Yap
          </h3>
          <p className="mt-2 text-sm text-slate-400">
            {showPasswordModal
              ? "Hesabınızı doğrulamak için şifrenizi girin"
              : "Hesabınıza güvenle erişin"}
          </p>
        </div>
      )}

      <div
        className={`flex-1 flex flex-col justify-center ${compact ? "gap-0.5" : ""}`}
      >
        {!showPasswordModal ? (
          <form
            className={`${compact ? "space-y-5" : "space-y-7"} animate-in fade-in duration-500`}
            action={handleUsernameSubmit}
          >
            <div>
              {!compact ? (
                <label htmlFor="rumuz" className={labelClassName}>
                  Rumuz Giriniz...
                </label>
              ) : null}
              <div className="relative">
                {!isPremium && (
                  <User className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-300/65" />
                )}
                <input
                  type="text"
                  id="rumuz"
                  name="username"
                  placeholder={compact ? "Rumuz..." : "Rumuz..."}
                  value={rumuz}
                  onChange={handleUsernameChange}
                  maxLength={15}
                  className={inputClassName}
                />
                <div className={counterClassName}>{rumuz.length}/15</div>
              </div>
            </div>

            <div>
              {!compact ? (
                <label className={labelClassName}>Cinsiyet</label>
              ) : null}
              <div className={`flex justify-center ${compact ? "gap-2.5" : "gap-3"}`}>
                <label
                  className={`flex cursor-pointer items-center justify-center gap-2 border px-8 py-2 transition-all ${
                    isPremium
                      ? "rounded-2xl border-[#ffe8a3]/75 bg-white/62 text-[#071b3d] backdrop-blur-xl hover:bg-[#fff6d1]/35 has-[:checked]:border-black has-[:checked]:bg-[#ffe8a3] has-[:checked]:text-black has-[:checked]:ring-2 has-[:checked]:ring-[#fff6d1]/45"
                      : "rounded-2xl border-white/10 bg-white/[0.045] text-slate-400 hover:border-blue-400/35 hover:bg-blue-400/5 has-[:checked]:border-blue-400/55 has-[:checked]:bg-blue-500/15 has-[:checked]:text-blue-200 has-[:checked]:ring-2 has-[:checked]:ring-blue-400/10"
                  }`}
                >
                  <input
                    type="radio"
                    name="gender"
                    value="male"
                    checked={gender === "male"}
                    onChange={(e) =>
                      setGender(e.target.value as "male" | "female")
                    }
                    className="hidden"
                  />
                  <Mars className="h-4 w-4" />
                  <span className={`${compact ? "text-[14px]" : "text-sm"} font-bold`}>Erkek</span>
                </label>
                <label
                  className={`flex cursor-pointer items-center justify-center gap-2 border px-7 py-2 transition-all ${
                    isPremium
                      ? "rounded-2xl border-[#ffe8a3]/75 bg-white/62 text-[#071b3d] backdrop-blur-xl hover:bg-[#fff6d1]/35 has-[:checked]:border-[#fff6d1] has-[:checked]:bg-black has-[:checked]:text-[#fff6d1] has-[:checked]:ring-2 has-[:checked]:ring-[#fff6d1]/45"
                      : "rounded-2xl border-white/10 bg-white/[0.045] text-slate-400 hover:border-fuchsia-400/35 hover:bg-fuchsia-400/5 has-[:checked]:border-fuchsia-400/55 has-[:checked]:bg-fuchsia-500/15 has-[:checked]:text-fuchsia-200 has-[:checked]:ring-2 has-[:checked]:ring-fuchsia-400/10"
                  }`}
                >
                  <input
                    type="radio"
                    name="gender"
                    value="female"
                    checked={gender === "female"}
                    onChange={(e) =>
                      setGender(e.target.value as "male" | "female")
                    }
                    className="hidden"
                  />
                  <Venus className="h-4 w-4" />
                  <span className={`${compact ? "text-[14px]" : "text-sm"} font-bold`}>Kadın</span>
                </label>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                type="submit"
                disabled={isPending}
                className={primaryButtonClassName}
              >
                {isPending ? "Kontrol Ediliyor..." : (submitLabel ?? (isPremium ? "Devam Et" : "Giriş Yap"))}
              </button>
            </div>

            {status.type === "error" && (
              <p className={`text-sm text-center ${errorClassName}`}>
                {status.message}
              </p>
            )}
          </form>
        ) : (
          <div
            className={`${compact ? "space-y-2.5" : "space-y-7"} animate-in fade-in duration-500`}
          >
            <div>
              {!compact ? (
                <label htmlFor="password" className={labelClassName}>
                  Şifrenizi Giriniz
                </label>
              ) : null}
              <div className="relative">
                <input
                  type={showPasswordValue ? "text" : "password"}
                  id="password"
                  value={password}
                  onChange={handlePasswordChange}
                  placeholder={compact ? "Şifre..." : ""}
                  className={`${inputClassName} ${isPremium ? "pr-12" : "pr-10"}`}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordValue(!showPasswordValue)}
                  className={`absolute inset-y-0 right-0 flex items-center pr-4 transition-colors ${
                    isPremium
                      ? "text-black hover:text-[#071b3d]"
                      : "text-slate-500 hover:text-cyan-300"
                  }`}
                >
                  {showPasswordValue ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div>
              {!compact ? (
                <label htmlFor="agentNickname" className={labelClassName}>
                  İkinci Rumuz (Ajan Girişi - İsteğe Bağlı)
                </label>
              ) : null}
              <input
                type="text"
                id="agentNickname"
                value={agentNickname}
                onChange={(e) => setAgentNickname(e.target.value)}
                placeholder={
                  compact
                    ? "2. rumuz (ajan girisi)"
                    : "Görünmesini istediğiniz isim"
                }
                maxLength={20}
                className={inputClassName}
              />
              {!compact ? (
                <p className={`mt-2 text-xs ${helperClassName}`}>
                  Bu isim sadece bu oturum için geçerli olacaktır.
                </p>
              ) : null}
            </div>

            {status.type === "error" && (
              <p className={`text-sm text-center ${errorClassName}`}>
                {status.message}
              </p>
            )}

            <div
              className={`flex ${compact ? "gap-2.5 pt-0.5" : "gap-4 pt-2"}`}
            >
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className={secondaryButtonClassName}
              >
                {compact ? "Vazgeç" : "Geri Dön"}
              </button>
              <button
                type="button"
                onClick={handleLoginSubmit}
                disabled={isPending}
                className={`flex-1 ${primaryButtonClassName}`}
              >
                {isPending
                  ? compact
                    ? "Bağlanıyor..."
                    : "Giriş Yapılıyor..."
                  : compact
                    ? "Bağlan!"
                    : "Giriş Yap"}
              </button>
            </div>
          </div>
        )}
      </div>

      {!hideFooter ? (
        <div className={`${footerNavClassName} ${compact ? "mt-3 pt-3" : ""}`}>
          <div
            className={`flex items-center justify-center text-center ${compact ? "gap-5" : "gap-8 sm:gap-12"}`}
          >
            <button
              type="button"
              className={footerNavItemClassName}
              onClick={() => setActiveInfoModal("privacy")}
            >
              Gizlilik
            </button>
            <button
              type="button"
              className={footerNavItemClassName}
              onClick={() => setActiveInfoModal("rules")}
            >
              Kurallar
            </button>
            <button
              type="button"
              className={footerNavItemClassName}
              onClick={() => setActiveInfoModal("info")}
            >
              Bilgilendirme
            </button>
          </div>
        </div>
      ) : null}

      {currentInfoModal ? (
        <div
          className={infoModalOverlayClassName}
          onClick={() => setActiveInfoModal(null)}
        >
          <div
            className={infoModalCardClassName}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="mb-3 text-center text-xl font-bold tracking-tight text-zinc-600 sm:text-2xl">
              {currentInfoModal.title}
            </h2>
            <div className="mx-auto max-h-[40vh] max-w-3xl overflow-y-auto pr-1 text-[13px] leading-5 text-zinc-600 sm:max-h-[42vh] sm:text-sm sm:leading-6">
              {currentInfoModal.body}
            </div>
            <button
              type="button"
              onClick={() => setActiveInfoModal(null)}
              className={infoModalButtonClassName}
            >
              Okudum, anladım.
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default LoginForm;
