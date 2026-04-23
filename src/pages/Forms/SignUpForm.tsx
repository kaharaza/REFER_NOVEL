import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { showToast } from "../../utils/showToast";
import Input from "../../component/Inputs/Input";
import { ToastContainer } from "react-toastify";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import InfoModal from "../../component/layout/InfoModal";
import SearchableSelect from "../../component/Inputs/SearchableSelect";
import { PostAddWorksplace, PostRegister } from "../../api/PostApi";
import type {
  DataFormSubmitProps,
  DataHospitalProps,
  WorkplacePayload,
} from "../../types/type";
import { GetHospitalsWorkplace } from "../../api/GetApi";
import { LoadingForm } from "../../component/LoadingForm";

type Workplace = {
  type?: "hospital" | "clinic"; // รพส. หรือ คลินิก
  name: string; // ชื่อสถานที่
};

export default function SignUpForm() {
  // === Recaptcha ===
  const { executeRecaptcha } = useGoogleReCaptcha();
  // === useState ===
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [data_hospital, setData_hospital] = useState<DataHospitalProps[]>([]);
  const [suggestions, setSuggestions] = useState<typeof data_hospital>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<string>("");
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    ceLicense: "",
    phone: "",
    lineID: "",
    workplaces: [""], // เปลี่ยนเป็น array
    password: "",
    confirmPassword: "",
  });

  const [formDataWorkplace, setFormDataWorkplace] = useState<Workplace>({
    type: "hospital",
    name: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>(""); // สำหรับ workplace
  // Detect if any workplace field has a duplicate-entry error
  const hasWorkplaceDuplicateError = Object.keys(errors).some(
    (k) => k.startsWith("workplaces[") && errors[k]?.includes("ซ้ำ"),
  );
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [addWorkloction, setAddWorkloction] = useState<boolean>(false);

  // === License sub-fields ===
  const [licensePrefix, setLicensePrefix] = useState("");
  const [licenseMid, setLicenseMid] = useState("");
  const [licenseYear, setLicenseYear] = useState("");
  const [licenseVerified, setLicenseVerified] = useState(false);
  const [licenseSubErrors, setLicenseSubErrors] = useState({
    prefix: "",
    mid: "",
    year: "",
  });

  const [passwordStrength, setPasswordStrength] = useState({
    hasSpecialChar: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasMinLength: false,
  });

  // === useRef ===
  const inputRef = useRef<HTMLInputElement>(null);
  const workplace0Ref = useRef<HTMLDivElement>(null);
  const closeModal = () => setActiveModal(null);

  // === Function ===
  // ฟังก์ชันตรวจสอบความแข็งแรงของรหัสผ่าน
  const checkPasswordStrength = (password: string) => {
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasMinLength = password.length >= 8;

    setPasswordStrength({
      hasSpecialChar,
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasMinLength,
    });
  };

  // === Function ดึงข้อมูลสถานที่ === //
  const useRefDataHopitals = useRef(false);
  useEffect(() => {
    if (useRefDataHopitals.current) return;
    useRefDataHopitals.current = true;
    fetchDataHospitalWorkplace();
  }, []);

  const fetchDataHospitalWorkplace = async () => {
    setIsLoading(true);
    setMessages("กำลังโหลดข้อมูล...");
    try {
      const resp = await GetHospitalsWorkplace();
      if (!resp.success) {
        showToast.error("เกิดข้อผิดพลาดในการดึงข้อมูลสถานที่");
        setIsLoading(false);
        return;
      }

      setData_hospital(resp.data);
      setMessages("");
      setIsLoading(false);
    } catch (error) {
      console.log("Error in fetchDataHospitalWorkplace:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // เมื่อ type เปลี่ยน → ล้าง suggestion
  useEffect(() => {
    setSuggestions([]);
    setShowSuggestions(false);
  }, [formDataWorkplace.type]);

  const isDuplicateWorkplace = (
    value: string,
    currentIndex: number,
  ): boolean => {
    if (!value.trim()) return false;
    return formData.workplaces.some(
      (wp, i) => i !== currentIndex && wp === value,
    );
  };

  const handleChange = (field: string, value: string, index?: number) => {
    if (field === "workplaces" && typeof index === "number") {
      if (isDuplicateWorkplace(value, index)) {
        showToast.wran("สถานที่นี้ถูกเลือกไปแล้ว กรุณาเลือกสถานที่อื่น");
        setErrors((prev) => ({
          ...prev,
          [`workplaces[${index}]`]: "สถานที่นี้ถูกเลือกซ้ำ",
        }));
        return;
      }
      const updated = [...formData.workplaces];
      updated[index] = value;
      setFormData((prev) => ({ ...prev, workplaces: updated }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));

      // ตรวจสอบความแข็งแรงของรหัสผ่านเมื่อมีการพิมพ์
      if (field === "password") {
        checkPasswordStrength(value);
      }
    }

    // ลบ error เมื่อพิมพ์
    if (errors[field] || errors[`workplaces[${index}]`]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        if (index !== undefined) delete newErrors[`workplaces[${index}]`];
        return newErrors;
      });
    }
  };

  const sanitizeInputName = (text: string): string => {
    return text
      .replace(/โรงพยาบาลสัตว์\s*/gi, "") // ตัดคำนำหน้า + space หลัง
      .replace(/โรงพยาบาล\s*/gi, "") // ตัดคำนำหน้า + space หลัง
      .replace(/คลินิก\s*/gi, "") // ตัดคำนำหน้า + space หลัง
      .replace(/\s+/g, "") // 🧹 ตัดช่องว่างทั้งหมด (รวมหลายช่อง)
      .trim(); // ตัด space หัว-ท้าย (เผื่อเหลือ)
  };

  const handleChangeWorkplace = (field: "type" | "name", value: string) => {
    if (field === "name") {
      setFormDataWorkplace((prev) => ({ ...prev, name: value })); // Store raw value

      if (error) setError("");

      if (formDataWorkplace.type === "hospital" && value.trim()) {
        const filtered = filterHospitals(value);
        setSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } else {
      setFormDataWorkplace((prev) => ({
        ...prev,
        type: value as "hospital" | "clinic",
        name: "", // Clear name when type changes
      }));
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // เลือกจาก suggestion
  const handleSelectSuggestion = (hospitalName: string) => {
    const cleanedName = sanitizeInputName(hospitalName); // Sanitize it once upon selection

    setFormDataWorkplace((prev) => ({ ...prev, name: cleanedName }));
    setSuggestions([]);
    setShowSuggestions(false);
    setError(""); // Clear any previous error
  };
  // ตรวจสอบก่อนบันทึก
  const validateWorkplace = (): boolean => {
    const cleanedName = sanitizeInputName(formDataWorkplace.name);
    if (!cleanedName.trim()) {
      setError("กรุณากรอกชื่อสถานที่");
      return false;
    }
    if (!isThaiOnly(cleanedName)) {
      setError("กรุณากรอกเป็นภาษาไทยเท่านั้น");
      return false;
    }
    if (
      formDataWorkplace.type === "hospital" &&
      isHospitalExists(cleanedName)
    ) {
      setError("ข้อมูลนี้มีอยู่แล้วในระบบ");
      return false;
    }
    setError(""); // ล้าง error ถ้าผ่าน
    return true;
  };

  const addWorkplace = () => {
    if (formData.workplaces.length < 10) {
      setFormData((prev) => ({
        ...prev,
        workplaces: [...prev.workplaces, ""],
      }));
    } else {
      showToast.info("เพิ่มได้สูงสุด 10 แห่ง");
    }
  };

  const removeWorkplace = (index: number) => {
    if (formData.workplaces.length <= 1) {
      showToast.error("ต้องระบุอย่างน้อย 1 แห่ง");
      return;
    }
    setFormData((prev) => ({
      ...prev,
      workplaces: prev.workplaces.filter((_, i) => i !== index),
    }));
    if (errors[`workplaces[${index}]`]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[`workplaces[${index}]`];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "กรุณากรอกชื่อ";
      showToast.error("กรุณากรอกชื่อ");
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = "กรุณากรอกนามสกุล";
      showToast.error("กรุณากรอกนามสกุล");
    }
    if (!formData.email.trim()) {
      newErrors.email = "กรุณากรอกอีเมล";
      showToast.error("กรุณากรอกอีเมล");
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "รูปแบบอีเมลไม่ถูกต้อง";
      showToast.error("รูปแบบอีเมลไม่ถูกต้อง");
    }
    if (!formData.ceLicense.trim()) {
      newErrors.ceLicense = "กรุณากรอกและยืนยันรหัสสัตวแพทย์";
      showToast.error("กรุณากรอกและยืนยันรหัสสัตวแพทย์");
    } else if (!/^\d{2}-\d{3,7}\/\d{4}$/.test(formData.ceLicense.trim())) {
      newErrors.ceLicense = "รูปแบบรหัสไม่ถูกต้อง กรุณากด 'ตรวจสอบ / รวมรหัส'";
      showToast.error("รูปแบบรหัสไม่ถูกต้อง กรุณากด 'ตรวจสอบ / รวมรหัส'");
    }
    if (!formData.phone.trim()) {
      newErrors.phone = "กรุณากรอกเบอร์โทรศัพท์";
      showToast.error("กรุณากรอกเบอร์โทรศัพท์");
    } else if (!/^[0-9]{9,10}$/.test(formData.phone)) {
      newErrors.phone = "เบอร์โทรต้องเป็นตัวเลข 9-10 หลัก";
      showToast.error("เบอร์โทรต้องเป็นตัวเลข 9-10 หลัก");
    }
    if (!formData.lineID.trim()) {
      newErrors.lineID = "กรุณากรอก Line ID";
      showToast.error("กรุณากรอก Line ID");
    }

    // ตรวจสอบสถานที่ทำงาน
    const seenWorkplaces = new Set<string>();
    formData.workplaces.forEach((wp, index) => {
      if (!wp.trim()) {
        newErrors[`workplaces[${index}]`] = "กรุณากรอกสถานที่ทำงาน";
        if (index === 0) showToast.error("กรุณากรอกสถานที่ทำงาน");
      } else if (seenWorkplaces.has(wp)) {
        newErrors[`workplaces[${index}]`] = "สถานที่นี้ถูกเลือกซ้ำ";
        showToast.error("มีสถานที่ทำงานที่ถูกเลือกซ้ำกัน กรุณาตรวจสอบ");
      } else {
        seenWorkplaces.add(wp);
      }
    });

    // ตรวจสอบรหัสผ่านตามเงื่อนไขใหม่
    const password = formData.password.trim();
    if (!password) {
      newErrors.password = "กรุณากรอกรหัสผ่าน";
      showToast.error("กรุณากรอกรหัสผ่าน");
    } else {
      // บังคับให้เป็นภาษาอังกฤษและตัวเลข + สัญลักษณ์เท่านั้น
      if (!/^[a-zA-Z0-9!@#$%^&*(),.?":{}|<>]*$/.test(password)) {
        newErrors.password =
          "รหัสผ่านต้องเป็นภาษาอังกฤษ ตัวเลข หรือสัญลักษณ์พิเศษเท่านั้น";
        showToast.error(
          "รหัสผ่านต้องเป็นภาษาอังกฤษ ตัวเลข หรือสัญลักษณ์พิเศษเท่านั้น",
        );
      } else {
        // ตรวจสอบแต่ละเงื่อนไข
        const checks = {
          hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
          hasUppercase: /[A-Z]/.test(password),
          hasLowercase: /[a-z]/.test(password),
          hasNumber: /\d/.test(password),
          hasMinLength: password.length >= 8,
        };

        if (!checks.hasMinLength) {
          newErrors.password = "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร";
          showToast.error("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
        } else if (!checks.hasLowercase) {
          newErrors.password =
            "รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษตัวเล็กอย่างน้อย 1 ตัว";
          showToast.error(
            "รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษตัวเล็กอย่างน้อย 1 ตัว",
          );
        } else if (!checks.hasUppercase) {
          newErrors.password =
            "รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษตัวใหญ่อย่างน้อย 1 ตัว";
          showToast.error(
            "รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษตัวใหญ่อย่างน้อย 1 ตัว",
          );
        } else if (!checks.hasNumber) {
          newErrors.password = "รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว";
          showToast.error("รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว");
        } else if (!checks.hasSpecialChar) {
          newErrors.password = "รหัสผ่านต้องมีสัญลักษณ์พิเศษอย่างน้อย 1 ตัว";
          showToast.error("รหัสผ่านต้องมีสัญลักษณ์พิเศษอย่างน้อย 1 ตัว");
        }
      }
    }

    // ตรวจสอบยืนยันรหัสผ่าน
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "รหัสผ่านไม่ตรงกัน";
      showToast.error("รหัสผ่านไม่ตรงกัน");
    }

    return newErrors;
  };

  // === License validation & combine ===
  const validateLicenseParts = (): boolean => {
    const newErrors = { prefix: "", mid: "", year: "" };
    let valid = true;

    if (!/^\d{2}$/.test(licensePrefix)) {
      newErrors.prefix = "ต้องเป็นตัวเลข 2 หลักพอดี (เช่น 01)";
      valid = false;
    }
    if (!/^\d{3,7}$/.test(licenseMid)) {
      newErrors.mid = "ต้องเป็นตัวเลข 3–7 หลัก";
      valid = false;
    }
    const yearNum = parseInt(licenseYear, 10);
    if (!/^\d{4}$/.test(licenseYear) || yearNum < 2500 || yearNum > 2699) {
      newErrors.year = "ต้องเป็นปี พ.ศ. 4 หลัก (2500–2699)";
      valid = false;
    }

    setLicenseSubErrors(newErrors);
    return valid;
  };

  const handleVerifyLicense = () => {
    if (validateLicenseParts()) {
      const combined = `${licensePrefix}-${licenseMid}/${licenseYear}`;
      setFormData((prev) => ({ ...prev, ceLicense: combined }));
      setLicenseVerified(true);
      setErrors((prev) => {
        const next = { ...prev };
        delete next.ceLicense;
        return next;
      });
    } else {
      setLicenseVerified(false);
      setFormData((prev) => ({ ...prev, ceLicense: "" }));
    }
  };

  const handleAddWorkplace = async () => {
    if (!validateWorkplace()) return;
    if (!executeRecaptcha) {
      showToast.error("ไม่สามารถโหลด reCAPTCHA ได้ ลองใหม่อีกครั้ง");
      return;
    }

    try {
      setIsLoading(true);
      setMessages("กำลังเพิ่มข้อมูล...");
      const token = await executeRecaptcha("hospital_workplace");
      if (!token) {
        showToast.error("ยืนยัน reCAPTCHA ไม่สำเร็จ");
        setIsLoading(false); // Stop loading
        return;
      }

      const cleanedName = sanitizeInputName(formDataWorkplace.name);

      const payload: WorkplacePayload = {
        name: cleanedName,
        type: formDataWorkplace.type,
        recaptchaToken: token,
      };

      const resp = await PostAddWorksplace(payload);

      if (!resp.success) {
        showToast.error(resp.message || "เกิดข้อผิดพลาดในการเพิ่มสถานที่");
        setIsLoading(false); // Stop loading
        return;
      }

      const meg = `เพิ่ม "${cleanedName}" (${
        formDataWorkplace.type === "hospital" ? "โรงพยาบาลสัตว์" : "คลินิก"
      }) สำเร็จ!`;

      showToast.success(meg);

      setFormDataWorkplace({ type: "hospital", name: "" });
      await fetchDataHospitalWorkplace();
      setAddWorkloction(false);
      // Focus Place 1 after successful add
      setTimeout(() => {
        workplace0Ref.current?.querySelector("input")?.focus();
      }, 100);
    } catch (error) {
      showToast.error("เกิดข้อผิดพลาดในการเพิ่มสถานที่");
      setIsLoading(false); // Stop loading
    }
  };

  const handleSubmit = async () => {
    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    if (!executeRecaptcha) {
      showToast.error("ไม่สามารถโหลด reCAPTCHA ได้ ลองใหม่อีกครั้ง");
      return;
    }

    setIsLoading(true);
    setMessages("กำลังเพิ่มข้อมูล...");
    try {
      const token = await executeRecaptcha("signup");
      if (!token) {
        showToast.error("ยืนยัน reCAPTCHA ไม่สำเร็จ");
        return;
      }

      const payload: DataFormSubmitProps = {
        ceLicense: formData.ceLicense,
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        lineID: formData.lineID,
        password: formData.password,
        recaptchaToken: token,
        workplaces: formData.workplaces,
        phone: formData.phone,
      };

      const resp = await PostRegister(payload);

      if (!resp.success) {
        setIsLoading(false);
        setTimeout(() => {
          showToast.error(resp ? resp : "เกิดข้อผิดพลาดในการลงทะเบียน");
        }, 1000);
        return;
      }

      setMessages("ลงทะเบียนสำเร็จ! ยินดีต้อนรับ");
      setTimeout(async () => {
        setIsLoading(false);
        setMessages("");
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      setIsLoading(false);

      showToast.error("เกิดข้อผิดพลาด: " + err.message);
    }
  };

  // ซ่อน suggestion เมื่อคลิกนอก
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ตรวจสอบภาษาไทย
  const isThaiOnly = (text: string): boolean => {
    const thaiRegex = /^[\u0E00-\u0E7F\s\d.,()\-/]+$/;
    return thaiRegex.test(text.trim()) && text.trim() !== "";
  };

  // ตรวจสอบว่ามีใน data_hospital
  const isHospitalExists = (hospitalName: string): boolean => {
    return data_hospital.some((item) => item.name === hospitalName.trim());
  };

  // กรองข้อมูลตาม query
  // const filterHospitals = (query: string) => {
  //   if (!query.trim()) return [];
  //   return data_hospital.filter((item) =>
  //     item.hospital.toLowerCase().includes(query.toLowerCase())
  //   );
  // };

  const filterHospitals = (query: string) => {
    if (!query.trim()) return [];

    return data_hospital
      .map((item) => {
        // สร้าง label แบบเดียวกับที่ใช้ใน hospitalOptions
        const label =
          item.type === "hospital"
            ? `โรงพยาบาลสัตว์ ${item.name}`
            : `คลินิก ${item.name}`;
        return { ...item, label }; // เก็บ label ไว้ใช้กรอง
      })
      .filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
      .map(({ label, ...item }) => item); // คืนค่าเฉพาะ item เดิม (ไม่เอา label ที่เพิ่มชั่วคราว)
  };

  // แปลงให้เข้ากับ Select component
  const hospitalOptions = data_hospital.map((item) => ({
    value: item.id,
    label: item.type === "hospital" ? `${item.name}` : `${item.name}`,
    type: item.type,
  }));

  if (isLoading) {
    return <LoadingForm text={messages} />;
  }

  return (
    <div className="space-y-6">
      {/* Role Badge */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex justify-center"
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-linear-to-r from-indigo-600 to-purple-600 text-white rounded-full text-sm font-semibold shadow-sm">
          <span className="material-symbols-outlined text-base">
            person_add
          </span>
          <span>สมัครสมาชิก — สำหรับสัตวแพทย์ที่ต้องการส่งตัวสัตว์ป่วย</span>
        </div>
      </motion.div>

      {/* Info Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="flex items-center p-4 rounded-xl bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-200 shadow-sm"
      >
        <div className="shrink-0 p-2 bg-blue-100 rounded-lg mr-3">
          <span className="material-symbols-outlined text-blue-600">info</span>
        </div>
        <div>
          <p className="text-sm text-blue-800 font-medium">
            กรอกข้อมูลให้ครบถ้วนเพื่อลงทะเบียน
          </p>
          <p className="text-xs text-blue-600 mt-1">
            ระบบจะใช้ข้อมูลนี้สำหรับการติดต่อและยืนยันตัวตน
          </p>
        </div>
      </motion.div>

      {/* Toast Notification */}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        toastStyle={{
          borderRadius: "12px",
          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
          border: "1px solid #e5e7eb",
        }}
      />

      {/* Button Add Workplace */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="border-b pb-6 border-gray-200/60"
      >
        <motion.button
          onClick={() => setAddWorkloction(!addWorkloction)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center justify-center gap-2 bg-linear-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-xl font-medium shadow-lg hover:from-blue-600 hover:to-blue-700  w-full group"
        >
          <span className="material-symbols-outlined text-lg">
            {addWorkloction ? "close" : "add"}
          </span>
          {addWorkloction
            ? "ยกเลิกการเพิ่มข้อมูล"
            : "เพิ่มข้อมูลโรงพยาบาลสัตว์/คลินิกที่ไม่มีในระบบ"}
        </motion.button>

        <p className="text-sm text-gray-600 mt-2 flex items-center gap-1 justify-center">
          <span className="material-symbols-outlined text-base">info</span>
          กรณีที่ไม่เจอข้อมูลโรงพยาบาลสัตว์/คลินิกที่ต้องการ
          กรุณาคลิกปุ่มนี้เพื่อเพิ่มข้อมูล
        </p>

        <AnimatePresence>
          {addWorkloction && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-4 p-6 bg-linear-to-br from-blue-50/50 to-indigo-50/50 rounded-2xl border border-blue-200/50  space-y-4  relative overflow-hidden"
            >
              {/* Background Decoration */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-200/20 rounded-full -translate-y-12 translate-x-12"></div>
              <div className="absolute bottom-0 left-0 w-16 h-16 bg-indigo-200/20 rounded-full translate-y-8 -translate-x-8"></div>

              {/* ประเภท */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-4 p-3 bg-white rounded-xl border border-gray-200/60 shadow-sm"
              >
                <div className="flex items-center gap-2 text-blue-600">
                  <span className="material-symbols-outlined text-xl">
                    category
                  </span>
                  <label className="text-sm font-semibold min-w-20">
                    ประเภท:
                  </label>
                </div>
                <select
                  value={formDataWorkplace.type}
                  onChange={(e) =>
                    handleChangeWorkplace("type", e.target.value)
                  }
                  className="flex-1 border-0 bg-transparent text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-300 rounded-lg px-3 py-2"
                >
                  <option value="hospital">โรงพยาบาลสัตว์</option>
                  <option value="clinic">คลินิก</option>
                </select>
              </motion.div>

              {/* ชื่อสถานที่ */}
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="w-full relative"
              >
                <label className=" text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">
                    business
                  </span>
                  ชื่อสถานที่ทำงาน
                  <span className="text-red-500 text-sm">
                    กรอกเป็นภาษาไทยเท่านั้น
                  </span>
                  <span className="text-blue-600 font-medium">
                    (
                    {formDataWorkplace.type === "hospital"
                      ? "โรงพยาบาลสัตว์"
                      : "คลินิก"}
                    )
                  </span>
                </label>

                <div
                  className={`relative ${showSuggestions ? "h-86" : ""} `}
                  ref={inputRef}
                >
                  <div className="relative">
                    <input
                      type="text"
                      value={formDataWorkplace.name}
                      onChange={(e) =>
                        handleChangeWorkplace("name", e.target.value)
                      }
                      onFocus={() => {
                        if (
                          formDataWorkplace.type === "hospital" &&
                          formDataWorkplace.name.trim()
                        ) {
                          const filtered = filterHospitals(
                            formDataWorkplace.name,
                          );
                          setSuggestions(filtered);
                          setShowSuggestions(filtered.length > 0);
                        }
                      }}
                      onBlur={() => {
                        // ล่าช้าในการปิด suggestions เพื่อให้สามารถคลิกเลือกได้
                        setTimeout(() => setShowSuggestions(false), 200);
                      }}
                      placeholder={
                        formDataWorkplace.type === "hospital"
                          ? "พิมพ์ชื่อโรงพยาบาลสัตว์ เช่น 'เชียงใหม่สัตวแพทย์'..."
                          : "พิมพ์ชื่อคลินิก..."
                      }
                      className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2  text-gray-700 placeholder-gray-400 ${
                        error
                          ? "border-red-400 focus:ring-red-300 focus:border-red-500"
                          : "border-blue-200 focus:ring-blue-300 focus:border-blue-500"
                      }`}
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-400">
                      <span className="material-symbols-outlined">search</span>
                    </div>
                  </div>

                  {/* Help Text */}
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 mt-2 text-xs text-gray-500 bg-yellow-50/80 px-3 py-2 rounded-lg border border-yellow-200"
                  >
                    <span className="material-symbols-outlined text-yellow-500 text-sm">
                      info
                    </span>
                    <p>
                      ไม่ต้องพิมพ์คำนำหน้าเช่น "โรงพยาบาลสัตว์", "รพส." หรือ
                      "คลินิก"
                    </p>
                  </motion.div>

                  {/* Suggestion Dropdown - ปรับปรุงให้เห็นชัดเจน */}
                  <AnimatePresence>
                    {showSuggestions && suggestions.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -5, scale: 0.95 }}
                        className="absolute z-50 w-full mt-2" // ✅ เพิ่ม z-index สูงมาก
                      >
                        <div className="bg-white border-2 border-blue-300 rounded-xl shadow-2xl overflow-hidden">
                          <div className="p-2 bg-linear-to-r from-blue-500 to-blue-600 text-white font-semibold text-sm flex items-center gap-2">
                            <span className="material-symbols-outlined text-base">
                              lightbulb
                            </span>
                            คำแนะนำที่พบ ({suggestions.length} รายการ)
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {suggestions.map((item, index) => (
                              <motion.div
                                key={item.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                onClick={() => {
                                  handleSelectSuggestion(item.name);
                                  setShowSuggestions(false);
                                }}
                                className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150 flex items-center gap-3 group"
                                onMouseEnter={(e) =>
                                  e.currentTarget.classList.add("bg-blue-50")
                                }
                                onMouseLeave={(e) =>
                                  e.currentTarget.classList.remove("bg-blue-50")
                                }
                              >
                                {/* <span
                                  className={`p-2 rounded-full ${
                                    item.type === "hospital"
                                      ? "bg-blue-100 text-blue-600 group-hover:bg-blue-200"
                                      : "bg-green-100 text-green-600 group-hover:bg-green-200"
                                  } transition-colors`}
                                >
                                  <span className="material-symbols-outlined text-sm">
                                    {item.type === "hospital"
                                      ? "local_hospital"
                                      : "medical_services"}
                                  </span>
                                </span> */}
                                <div className="flex-1">
                                  <div className="font-semibold text-gray-800 group-hover:text-blue-700 transition-colors">
                                    {item.name}
                                  </div>
                                  <div className="text-xs text-gray-500 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-xs">
                                      location_on
                                    </span>
                                    {item.type === "hospital"
                                      ? "โรงพยาบาลสัตว์"
                                      : "คลินิก"}
                                  </div>
                                </div>
                                <span className="material-symbols-outlined text-gray-400 group-hover:text-blue-500 text-sm">
                                  arrow_forward
                                </span>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Empty State เมื่อค้นหาแต่ไม่พบผลลัพธ์ */}
                  <AnimatePresence>
                    {showSuggestions &&
                      suggestions.length === 0 &&
                      formDataWorkplace.name.trim() && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="absolute z-50 w-full mt-2"
                        >
                          <div className="bg-white border-2 border-orange-200 rounded-xl shadow-lg p-4 text-center">
                            <span className="material-symbols-outlined text-orange-500 text-2xl mb-2">
                              search_off
                            </span>
                            <p className="text-orange-700 font-medium">
                              ไม่พบสถานที่ทำงานที่ตรงกัน
                            </p>
                            <p className="text-orange-600 text-sm">
                              คุณสามารถเพิ่มสถานที่ทำงานใหม่ได้
                            </p>
                          </div>
                        </motion.div>
                      )}
                  </AnimatePresence>
                </div>

                {error && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-red-500 text-sm mt-2 flex items-center gap-2 bg-red-50 px-3 py-2 rounded-lg border border-red-200"
                  >
                    <span className="material-symbols-outlined text-base">
                      error
                    </span>
                    {error}
                  </motion.p>
                )}
              </motion.div>

              {/* Duplicate Warning */}
              {(() => {
                const cleanedInputName = sanitizeInputName(
                  formDataWorkplace.name,
                );
                const isDuplicate =
                  cleanedInputName.trim() !== "" &&
                  isHospitalExists(cleanedInputName);
                return isDuplicate ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 bg-amber-50 border-2 border-amber-400 rounded-xl shadow-md flex flex-col gap-2"
                  >
                    <div className="flex items-center gap-2 text-amber-700 font-bold text-base">
                      <span className="material-symbols-outlined text-2xl text-amber-500">
                        warning
                      </span>
                      ข้อมูลนี้มีอยู่ในระบบแล้ว!
                    </div>
                    <p className="text-amber-800 text-sm font-medium">
                      สถานที่{" "}
                      <span className="font-bold">"{cleanedInputName}"</span>{" "}
                      มีอยู่ในระบบแล้ว
                      <br />
                      กรุณาเลือกสถานที่นี้จาก{" "}
                      <span className="font-bold text-blue-700">
                        สถานที่ที่ 1
                      </span>{" "}
                      ด้านล่างแทน
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setTimeout(() => {
                          workplace0Ref.current
                            ?.querySelector("input")
                            ?.focus();
                        }, 50);
                      }}
                      className="mt-1 self-start flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow transition-colors"
                    >
                      <span className="material-symbols-outlined text-base">
                        arrow_downward
                      </span>
                      ไปที่สถานที่ที่ 1
                    </button>
                  </motion.div>
                ) : null;
              })()}

              {/* ปุ่มเพิ่ม */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="pt-2"
              >
                {(() => {
                  const cleanedInputName = sanitizeInputName(
                    formDataWorkplace.name,
                  );
                  const isDuplicate =
                    cleanedInputName.trim() !== "" &&
                    isHospitalExists(cleanedInputName);
                  const isDisabled =
                    !formDataWorkplace.name.trim() || isDuplicate;
                  return (
                    <motion.button
                      type="button"
                      onClick={handleAddWorkplace}
                      disabled={isDisabled}
                      whileHover={{ scale: isDisabled ? 1 : 1.02 }}
                      whileTap={{ scale: isDisabled ? 1 : 0.98 }}
                      className={`w-full py-3 px-6 rounded-xl font-semibold flex items-center justify-center gap-2 ${
                        isDisabled
                          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                          : "bg-linear-to-r from-green-500 to-emerald-600 text-white shadow-lg hover:from-green-600 hover:to-emerald-700"
                      }`}
                    >
                      <span className="material-symbols-outlined text-lg">
                        add_circle
                      </span>
                      เพิ่มสถานที่ทำงานนี้
                    </motion.button>
                  );
                })()}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Hospital & Clinic List Box */}
      {data_hospital.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 bg-linear-to-r from-indigo-50 to-blue-50 border-b border-gray-200">
            <span className="material-symbols-outlined text-indigo-500 text-lg">
              location_city
            </span>
            <p className="text-sm font-semibold text-indigo-700">
              รายชื่อสถานที่ที่มีในระบบ
            </p>
            <span className="ml-auto text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200">
              {data_hospital.length} แห่ง
            </span>
          </div>

          {/* Two-column grid (scrollable when content is long) */}
          <div className="grid grid-cols-2 divide-x divide-gray-100 max-h-72 md:max-h-96 overflow-y-auto pr-2">
            {/* Left column */}
            <div className="p-3 space-y-1">
              <p className="text-xs font-semibold text-blue-600 mb-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">
                  local_hospital
                </span>
                โรงพยาบาลสัตว์
              </p>
              {data_hospital
                .filter((item) => item.type === "hospital")
                .map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                    <span className="text-xs text-gray-700 truncate">
                      {item.name}
                    </span>
                  </div>
                ))}
              {data_hospital.filter((item) => item.type === "hospital")
                .length === 0 && (
                <p className="text-xs text-gray-400 italic px-3">
                  ยังไม่มีข้อมูล
                </p>
              )}
            </div>

            {/* Right column */}
            <div className="p-3 space-y-1">
              <p className="text-xs font-semibold text-emerald-600 mb-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">
                  medical_services
                </span>
                คลินิก
              </p>
              {data_hospital
                .filter((item) => item.type === "clinic")
                .map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    <span className="text-xs text-gray-700 truncate">
                      {item.name}
                    </span>
                  </div>
                ))}
              {data_hospital.filter((item) => item.type === "clinic").length ===
                0 && (
                <p className="text-xs text-gray-400 italic px-3">
                  ยังไม่มีข้อมูล
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Workplace Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            สถานที่ทำงาน
          </label>
          <span className="text-xs text-gray-500">
            ({formData.workplaces.length}/10)
          </span>
        </div>

        {hasWorkplaceDuplicateError && (
          <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-base">error</span>
            มีสถานที่ทำงานที่ถูกเลือกซ้ำกัน กรุณาตรวจสอบ
          </p>
        )}

        {formData.workplaces.map((workplace, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center gap-3 group"
          >
            <div
              className="w-full relative"
              ref={index === 0 ? workplace0Ref : undefined}
            >
              {/* Searchable Select */}
              <SearchableSelect
                label={`สถานที่ที่ ${index + 1}`}
                id={`workplace-${index}`}
                name={`workplace-${index}`}
                value={workplace}
                onChange={(e) =>
                  handleChange("workplaces", e.target.value, index)
                }
                options={hospitalOptions}
                placeholder="พิมพ์เพื่อค้นหาโรงพยาบาล..."
                required
                icon="local_hospital"
                error={errors[`workplaces[${index}]`]}
              />
              {formData.workplaces.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeWorkplace(index)}
                  className="absolute -right-2.5 top-7 transform -translate-y-1/2  text-red-300  hover:text-red-900 transition-all duration-200 opacity-70 group-hover:opacity-100 cursor-pointer"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              )}
            </div>
          </motion.div>
        ))}

        {formData.workplaces.length < 10 && (
          <motion.button
            type="button"
            onClick={addWorkplace}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors duration-200 mt-2 p-2 pl-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg mr-2 bg-blue-100 text-blue-600 p-1 rounded-full">
              add
            </span>
            เพิ่มสถานที่ทำงาน
          </motion.button>
        )}
      </div>

      {/* Form Fields Grid */}
      <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
        <Input
          label="ชื่อ (ภาษาไทย)"
          id="firstName"
          name="firstName"
          value={formData.firstName}
          onChange={(e) => handleChange("firstName", e.target.value)}
          placeholder="กรอกชื่อจริง"
          required
          icon="person"
          error={errors.firstName}
          className="bg-white"
        />

        <Input
          label="นามสกุล (ภาษาไทย)"
          id="lastName"
          name="lastName"
          value={formData.lastName}
          onChange={(e) => handleChange("lastName", e.target.value)}
          placeholder="กรอกนามสกุล"
          required
          icon="assignment_ind"
          error={errors.lastName}
          className="bg-white"
        />

        <Input
          label="อีเมล"
          type="email"
          name="email"
          id="email"
          value={formData.email}
          onChange={(e) => handleChange("email", e.target.value)}
          placeholder="your.email@example.com"
          required
          icon="mail"
          error={errors.email}
          className="bg-white"
        />

        {/* รหัสสัตวแพทย์ — 3 ช่องกรอก */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-indigo-500">
              medical_services
            </span>
            รหัสสัตวแพทย์
            <span className="text-red-500">*</span>
          </label>

          <div className="grid grid-cols-3 gap-2">
            {/* Input 1: prefix */}
            <div>
              <p className="text-xs text-gray-500 mb-1">รหัสนำหน้า (2 หลัก)</p>
              <input
                type="text"
                inputMode="numeric"
                value={licensePrefix}
                maxLength={2}
                placeholder="01"
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 2);
                  setLicensePrefix(val);
                  setLicenseVerified(false);
                  setFormData((prev) => ({ ...prev, ceLicense: "" }));
                  if (licenseSubErrors.prefix)
                    setLicenseSubErrors((p) => ({ ...p, prefix: "" }));
                }}
                className={`w-full px-3 py-2.5 border-2 rounded-xl text-center font-mono text-gray-700 bg-white focus:outline-none focus:ring-2 ${
                  licenseSubErrors.prefix
                    ? "border-red-400 focus:ring-red-300 focus:border-red-500"
                    : "border-gray-200 focus:ring-blue-300 focus:border-blue-500"
                }`}
              />
              {licenseSubErrors.prefix && (
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">
                    error
                  </span>
                  {licenseSubErrors.prefix}
                </p>
              )}
            </div>
            {/* Input 2: mid */}
            <div>
              <p className="text-xs text-gray-500 mb-1">รหัสกลาง (3–7 หลัก)</p>
              <input
                type="text"
                inputMode="numeric"
                value={licenseMid}
                maxLength={7}
                placeholder="1234567"
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 7);
                  setLicenseMid(val);
                  setLicenseVerified(false);
                  setFormData((prev) => ({ ...prev, ceLicense: "" }));
                  if (licenseSubErrors.mid)
                    setLicenseSubErrors((p) => ({ ...p, mid: "" }));
                }}
                className={`w-full px-3 py-2.5 border-2 rounded-xl text-center font-mono text-gray-700 bg-white focus:outline-none focus:ring-2 ${
                  licenseSubErrors.mid
                    ? "border-red-400 focus:ring-red-300 focus:border-red-500"
                    : "border-gray-200 focus:ring-blue-300 focus:border-blue-500"
                }`}
              />
              {licenseSubErrors.mid && (
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">
                    error
                  </span>
                  {licenseSubErrors.mid}
                </p>
              )}
            </div>
            {/* Input 3: yearBE */}
            <div>
              <p className="text-xs text-gray-500 mb-1">ปี พ.ศ. (4 หลัก)</p>
              <input
                type="text"
                inputMode="numeric"
                value={licenseYear}
                maxLength={4}
                placeholder="2568"
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setLicenseYear(val);
                  setLicenseVerified(false);
                  setFormData((prev) => ({ ...prev, ceLicense: "" }));
                  if (licenseSubErrors.year)
                    setLicenseSubErrors((p) => ({ ...p, year: "" }));
                }}
                className={`w-full px-3 py-2.5 border-2 rounded-xl text-center font-mono text-gray-700 bg-white focus:outline-none focus:ring-2 ${
                  licenseSubErrors.year
                    ? "border-red-400 focus:ring-red-300 focus:border-red-500"
                    : "border-gray-200 focus:ring-blue-300 focus:border-blue-500"
                }`}
              />
              {licenseSubErrors.year && (
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">
                    error
                  </span>
                  {licenseSubErrors.year}
                </p>
              )}
            </div>
          </div>

          {/* Live preview */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200">
            <span className="material-symbols-outlined text-gray-400 text-base">
              preview
            </span>
            <span className="text-xs text-gray-500">ตัวอย่าง:</span>
            <span className="font-mono text-sm font-semibold text-gray-800">
              {licensePrefix || "??"}
              <span className="text-gray-400">-</span>
              {licenseMid || "???"}
              <span className="text-gray-400">/</span>
              {licenseYear || "????"}
            </span>
          </div>

          {/* Verify button */}
          <motion.button
            type="button"
            onClick={handleVerifyLicense}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`w-full py-2.5 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
              licenseVerified
                ? "bg-green-50 text-green-700 border-2 border-green-400"
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            }`}
          >
            <span className="material-symbols-outlined text-base">
              {licenseVerified ? "check_circle" : "verified"}
            </span>
            {licenseVerified
              ? `ยืนยันแล้ว: ${formData.ceLicense}`
              : "ตรวจสอบ / รวมรหัส"}
          </motion.button>

          {/* Form-level error */}
          {errors.ceLicense && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-red-500 text-sm flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-base">error</span>
              {errors.ceLicense}
            </motion.p>
          )}

          {/* Hidden input for form submission */}
          <input type="hidden" name="vet_code" value={formData.ceLicense} />
        </div>

        <Input
          label="เบอร์โทรศัพท์"
          type="tel"
          id="phone"
          name="phone"
          value={formData.phone}
          onChange={(e) => handleChange("phone", e.target.value)}
          placeholder="081-234-5678"
          required
          icon="call"
          error={errors.phone}
          className="bg-white"
        />

        <Input
          label="Line ID"
          type="text"
          id="lineID"
          name="lineID"
          value={formData.lineID}
          onChange={(e) => handleChange("lineID", e.target.value)}
          placeholder="Line ID ของคุณ"
          required
          icon="chat"
          error={errors.lineID}
          className="bg-white"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="grid grid-cols-1 md:grid-cols-2 justify-start items-start gap-4"
      >
        {/* Password Section */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="col-span-2 md:col-span-1"
        >
          <Input
            label="รหัสผ่าน"
            type={showPassword ? "text" : "password"}
            id="password"
            name="password"
            value={formData.password}
            onChange={(e) => handleChange("password", e.target.value)}
            placeholder="กรอกรหัสผ่าน"
            required
            icon="lock"
            error={errors.password}
            className="bg-white"
          />
        </motion.div>

        {/* Confirm Password Section */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="col-span-2 md:col-span-1"
        >
          <Input
            label="ยืนยันรหัสผ่าน"
            type={showPassword ? "text" : "password"}
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={(e) => handleChange("confirmPassword", e.target.value)}
            placeholder="กรอกรหัสผ่านอีกครั้ง"
            required
            icon="lock"
            error={errors.confirmPassword}
            className="bg-white"
          />
        </motion.div>

        {/* Show Password Toggle */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="col-span-2 flex items-center justify-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200"
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 cursor-pointer"
          >
            <input
              type="checkbox"
              name="changeText"
              id="changeText"
              checked={showPassword}
              onChange={() => setShowPassword(!showPassword)}
              className="w-4 h-4 accent-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <label
              htmlFor="changeText"
              className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">
                {showPassword ? "visibility" : "visibility_off"}
              </span>
              {showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
            </label>
          </motion.div>
        </motion.div>

        {/* Password Strength Indicator */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="col-span-2 space-y-3 p-4 bg-linear-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200"
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-blue-600 text-xl">
              security
            </span>
            <h4 className="font-semibold text-gray-800">
              ความแข็งแรงของรหัสผ่าน
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-1 gap-1">
            {/* Column 1 */}
            <div className="space-y-1">
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.5 }}
                className={`flex items-center gap-3 p-2 rounded-lg transition-all duration-200 ${
                  passwordStrength.hasSpecialChar
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                <span className="material-symbols-outlined text-lg">
                  {passwordStrength.hasSpecialChar
                    ? "check_circle"
                    : "radio_button_unchecked"}
                </span>
                <span className="text-xs font-medium">
                  มีสัญลักษณ์พิเศษ (!@#$%^&*)
                </span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.6 }}
                className={`flex items-center gap-3 p-2 rounded-lg transition-all duration-200 ${
                  passwordStrength.hasUppercase
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                <span className="material-symbols-outlined text-lg">
                  {passwordStrength.hasUppercase
                    ? "check_circle"
                    : "radio_button_unchecked"}
                </span>
                <span className="text-xs font-medium">
                  มีตัวอักษรภาษาอังกฤษตัวใหญ่ (A-Z)
                </span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.7 }}
                className={`flex items-center gap-3 p-2 rounded-lg transition-all duration-200 ${
                  passwordStrength.hasNumber
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                <span className="material-symbols-outlined text-lg">
                  {passwordStrength.hasNumber
                    ? "check_circle"
                    : "radio_button_unchecked"}
                </span>
                <span className="text-xs font-medium">มีตัวเลข (0-9)</span>
              </motion.div>
            </div>

            {/* Column 2 */}
            <div className="space-y-2">
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.5 }}
                className={`flex items-center gap-3 p-2 rounded-lg transition-all duration-200 ${
                  passwordStrength.hasLowercase
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                <span className="material-symbols-outlined text-lg">
                  {passwordStrength.hasLowercase
                    ? "check_circle"
                    : "radio_button_unchecked"}
                </span>
                <span className="text-xs font-medium">
                  มีตัวอักษรภาษาอังกฤษตัวเล็ก (a-z)
                </span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.6 }}
                className={`flex items-center gap-3 p-2 rounded-lg transition-all duration-200 ${
                  passwordStrength.hasMinLength
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                <span className="material-symbols-outlined text-lg">
                  {passwordStrength.hasMinLength
                    ? "check_circle"
                    : "radio_button_unchecked"}
                </span>
                <span className="text-xs font-medium">
                  ความยาวอย่างน้อย 8 ตัวอักษร
                </span>
              </motion.div>

              {/* Password Strength Meter */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.8 }}
                className="p-3 bg-white rounded-lg border border-gray-200 mt-2"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-700">
                    ระดับความปลอดภัย
                  </span>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      Object.values(passwordStrength).filter(Boolean).length >=
                      4
                        ? "bg-green-100 text-green-800"
                        : Object.values(passwordStrength).filter(Boolean)
                              .length >= 2
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    {Object.values(passwordStrength).filter(Boolean).length >= 4
                      ? "แข็งแรง"
                      : Object.values(passwordStrength).filter(Boolean)
                            .length >= 2
                        ? "ปานกลาง"
                        : "อ่อน"}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${
                        (Object.values(passwordStrength).filter(Boolean)
                          .length /
                          5) *
                        100
                      }%`,
                    }}
                    transition={{ duration: 0.5, delay: 0.9 }}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      Object.values(passwordStrength).filter(Boolean).length >=
                      4
                        ? "bg-green-500"
                        : Object.values(passwordStrength).filter(Boolean)
                              .length >= 2
                          ? "bg-yellow-500"
                          : "bg-red-500"
                    }`}
                  />
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Submit Button */}
      <motion.button
        type="button"
        onClick={handleSubmit}
        whileHover={{
          scale: 1.02,
          boxShadow: "0 8px 25px rgba(79, 70, 229, 0.35)",
        }}
        whileTap={{ scale: 0.98 }}
        className="w-full bg-linear-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700  text-white py-4 rounded-xl shadow-lg font-medium text-base flex items-center justify-center gap-3 mt-6 transition-all duration-200"
      >
        <span className="material-symbols-outlined">how_to_reg</span>
        ยืนยันการสมัครสมาชิก
        <motion.span
          animate={{ x: [0, 5, 0] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="material-symbols-outlined"
        >
          arrow_forward
        </motion.span>
      </motion.button>

      {/* Privacy Notice */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center text-xs text-gray-500 mt-4"
      >
        <p>
          โดยการกดปุ่มยืนยัน คุณได้ยอมรับ{" "}
          <button
            type="button"
            onClick={() => setActiveModal("privacy")}
            className="text-blue-600 hover:text-blue-800 underline transition-colors"
          >
            นโยบายความเป็นส่วนตัว
          </button>{" "}
          และ{" "}
          <button
            type="button"
            onClick={() => setActiveModal("terms")}
            className="text-blue-600 hover:text-blue-800 underline transition-colors"
          >
            เงื่อนไขการใช้งาน
          </button>
        </p>
      </motion.div>
      {/* Modals */}
      {/* Privacy Policy */}
      <InfoModal
        isOpen={activeModal === "privacy"}
        onClose={closeModal}
        title="นโยบายความเป็นส่วนตัว"
        icon="privacy_tip"
      >
        <div className="space-y-4">
          <div className="flex items-start">
            <span className="material-symbols-outlined text-blue-500 mr-3 mt-0.5">
              security
            </span>
            <p className="text-gray-50">
              เรารักษ์ข้อมูลส่วนบุคคลของท่านอย่างสูงสุด
              ข้อมูลที่ท่านให้กับระบบจะถูกใช้เฉพาะเพื่อการส่งตัวสัตว์ป่วย
              และการติดต่อระหว่างโรงพยาบาลเท่านั้น
            </p>
          </div>

          <div className="flex items-start">
            <span className="material-symbols-outlined text-blue-500 mr-3 mt-0.5">
              visibility_off
            </span>
            <p className="text-gray-50">
              เราไม่เปิดเผยข้อมูลให้กับบุคคลที่สามโดยไม่ได้รับความยินยอม
              เว้นแต่ตามกฎหมายหรือหน่วยงานราชการร้องขอ
            </p>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mt-4">
            <h4 className="font-semibold text-blue-800 flex items-center">
              <span className="material-symbols-outlined text-blue-600 mr-2">
                database
              </span>
              ข้อมูลที่เราเก็บรวบรวม
            </h4>
            <ul className="list-none space-y-2 mt-3">
              <li className="flex items-center">
                <span className="material-symbols-outlined text-blue-500 text-sm mr-2">
                  check_circle
                </span>
                <span className="text-gray-900">
                  ชื่อ นามสกุล สังกัดหน่วยงาน
                </span>
              </li>
              <li className="flex items-center">
                <span className="material-symbols-outlined text-blue-500 text-sm mr-2">
                  check_circle
                </span>
                <span className="text-gray-900">อีเมลและเบอร์ติดต่อ</span>
              </li>
              <li className="flex items-center">
                <span className="material-symbols-outlined text-blue-500 text-sm mr-2">
                  check_circle
                </span>
                <span className="text-gray-900">ข้อมูลการใช้งานระบบ</span>
              </li>
            </ul>
          </div>
        </div>
      </InfoModal>

      {/* Terms of Service */}
      <InfoModal
        isOpen={activeModal === "terms"}
        onClose={closeModal}
        title="เงื่อนไขการใช้งาน"
        icon="policy"
      >
        <div className="space-y-4">
          <div className="flex items-start">
            <span className="material-symbols-outlined text-purple-500 mr-3 mt-0.5">
              verified_user
            </span>
            <p className="text-gray-50">
              การใช้งานระบบส่งตัวสัตว์ป่วยต้องเป็นผู้ลงทะเบียนและได้รับอนุญาตจากทางคณะสัตวแพทยศาสตร์
              มหาวิทยาลัยเชียงใหม่
            </p>
          </div>

          <div className="flex items-start">
            <span className="material-symbols-outlined text-purple-500 mr-3 mt-0.5">
              block
            </span>
            <p className="text-gray-50">
              ผู้ใช้ต้องไม่กระทำการใด ๆ ที่ละเมิดกฎหมาย หรือทำให้ระบบขัดข้อง
              เช่น การแฮก การใช้สคริปต์โจมตี
            </p>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg border border-purple-100 mt-4">
            <h4 className="font-semibold text-purple-800 flex items-center">
              <span className="material-symbols-outlined text-purple-600 mr-2">
                warning
              </span>
              ข้อจำกัดความรับผิดชอบ
            </h4>
            <p className="text-gray-700 mt-2">
              ทีมพัฒนาไม่รับผิดชอบต่อความเสียหายที่เกิดจากการใช้งานผิดวัตถุประสงค์
              หรือการล่าช้าในการส่งตัว ซึ่งเกิดจากปัจจัยภายนอก เช่น
              สัญญาณอินเทอร์เน็ต หรือการยืนยันล่าช้าจากโรงพยาบาลสัตว์ปลายทาง
            </p>
          </div>
        </div>
      </InfoModal>
    </div>
  );
}
