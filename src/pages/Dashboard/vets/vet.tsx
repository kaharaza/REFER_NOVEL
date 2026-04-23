import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { showToast } from "../../../utils/showToast";
import { ToastContainer } from "react-toastify";
import { getUserFromToken } from "../../../utils/authUtils";
import {
  type FormOwnerProp,
  type FormPetProp,
  type PayloadCreatedOwner,
  type PayloadFetchOwner,
  type PayloadUpdateOwner,
} from "../../../types/type";
import { PostCreatedOwner, PostCreatedPet } from "../../../api/PostApi";
import { GetOwners } from "../../../api/GetApi";
import { LoadingForm } from "../../../component/LoadingForm";
import { PutUpdateOwner, PutUpdatePet } from "../../../api/PutApi";
import { useConfirmTailwind } from "../../../hook/useConfirmTailwind";
import { DeleteOwner, DeletePet } from "../../../api/DeleteApi";
import {
  AlertCircle,
  ArrowBigDown,
  ArrowBigUp,
  ChevronLeft,
  ChevronRight,
  PlugIcon,
} from "lucide-react";
import { toLowerStr } from "../../../utils/helpers";

type AddressFields = {
  houseNumber: string;
  road: string;
  subdistrict: string;
  district: string;
  province: string;
  postalCode: string;
};

const ADDRESS_FIELDS_CONFIG: Array<{
  key: keyof AddressFields;
  label: string;
  required: boolean;
  placeholder: string;
  errorMsg: string;
}> = [
  {
    key: "houseNumber",
    label: "เลขที่บ้าน",
    required: true,
    placeholder: "เช่น 123/4 หมู่ 5",
    errorMsg: "กรุณากรอกเลขที่บ้าน",
  },
  {
    key: "road",
    label: "ถนน",
    required: false,
    placeholder: "เช่น สุขุมวิท (ถ้ามี)",
    errorMsg: "",
  },
  {
    key: "subdistrict",
    label: "ตำบล/แขวง",
    required: true,
    placeholder: "เช่น คลองตัน",
    errorMsg: "กรุณากรอกตำบล/แขวง",
  },
  {
    key: "district",
    label: "อำเภอ/เขต",
    required: true,
    placeholder: "เช่น คลองเตย",
    errorMsg: "กรุณากรอกอำเภอ/เขต",
  },
  {
    key: "province",
    label: "จังหวัด",
    required: true,
    placeholder: "เช่น กรุงเทพมหานคร",
    errorMsg: "กรุณากรอกจังหวัด",
  },
  {
    key: "postalCode",
    label: "รหัสไปรษณีย์",
    required: true,
    placeholder: "เช่น 10110",
    errorMsg: "กรุณากรอกรหัสไปรษณีย์ 5 หลัก",
  },
];

const buildAddressString = (fields: AddressFields): string =>
  [
    fields.houseNumber,
    fields.road,
    fields.subdistrict,
    fields.district,
    fields.province,
    fields.postalCode,
  ]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");

export default function VetsPage() {
  // === Get user login === //
  const userLogin = getUserFromToken();
  // === State === //
  const [owners, setOwners] = useState<FormOwnerProp[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");

  const [showCreateOwnerForm, setShowCreateOwnerForm] = useState(false);
  const [showCreatePetForm, setShowCreatePetForm] = useState(false);

  const [ownerForm, setOwnerForm] = useState<FormOwnerProp>({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    address: "",
  });
  const [addressFields, setAddressFields] = useState<AddressFields>({
    houseNumber: "",
    road: "",
    subdistrict: "",
    district: "",
    province: "",
    postalCode: "",
  });
  const [addressErrors, setAddressErrors] = useState<
    Partial<Record<keyof AddressFields, string>>
  >({});
  const [isEditingOwner, setIsEditingOwner] = useState(false);

  // Detect duplicate owner name (case-insensitive, trimmed).
  const isDuplicateName = useMemo(() => {
    const fn = (ownerForm.firstName || "").trim().toLowerCase();
    const ln = (ownerForm.lastName || "").trim().toLowerCase();
    if (!fn || !ln) return false;
    return owners.some((o) => {
      if (!o) return false;
      // If editing, ignore the current owner record
      if (ownerForm.id && o.id && o.id === ownerForm.id) return false;
      const ofn = (o.firstName || "").trim().toLowerCase();
      const oln = (o.lastName || "").trim().toLowerCase();
      return ofn === fn && oln === ln;
    });
  }, [owners, ownerForm.firstName, ownerForm.lastName, ownerForm.id]);

  // Incomplete required address fields (for the summary banner)
  const incompleteAddressFields = useMemo(() => {
    const isLegacyMode =
      isEditingOwner &&
      !addressFields.subdistrict.trim() &&
      !addressFields.district.trim() &&
      !addressFields.province.trim() &&
      !addressFields.postalCode.trim();
    return ADDRESS_FIELDS_CONFIG.filter((cfg) => {
      if (!cfg.required) return false;
      if (isLegacyMode && cfg.key !== "houseNumber") return false;
      const value = addressFields[cfg.key];
      if (!value.trim()) return true;
      if (cfg.key === "postalCode" && !/^\d{5}$/.test(value)) return true;
      return false;
    });
  }, [addressFields, isEditingOwner]);

  const [petForm, setPetForm] = useState<FormPetProp>({
    name: "",
    ownerId: "",
    color: "",
    sex: "M",
    weight: "",
    age: "",
    sterilization: "UNKNOWN",
    species: "Dog",
    exoticdescription: "",
    breed: "",
  });
  const [editingPetId, setEditingPetId] = useState<string>("");
  const [expandedOwner, setExpandedOwner] = useState<string>("");

  // === Loiading === //
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // === Confirm === //
  const { confirm, ConfirmModal } = useConfirmTailwind();

  // === useEffect === //
  const addressRefs = useRef<
    Partial<Record<keyof AddressFields, HTMLInputElement | null>>
  >({});
  const useRefFetchDataOwners = useRef(false);
  useEffect(() => {
    if (useRefFetchDataOwners.current) return;
    useRefFetchDataOwners.current = true;
    fetchDataOwners();
  }, []);

  const fetchDataOwners = async () => {
    if (!userLogin) {
      showToast.error("Please log in to continue");
      setLoading(false);
      return;
    }
    const veterinarianId = userLogin.id;
    const hospitalId = userLogin.hospitalId;

    if (!veterinarianId || !hospitalId) {
      showToast.error("Missing veterinarianId or hospitalId");
      setLoading(false);
      return;
    }

    const payload: PayloadFetchOwner = {
      veterinarianId,
      hospitalId,
    };

    setMessage("Fetching owners...");
    setLoading(true);

    try {
      const resp = await GetOwners(payload);

      if (!resp.success) {
        showToast.error("Error fetching owners");
        return;
      }

      const data = resp._data || [];
      if (data.length === 0) {
        showToast.error("No owners found");
      }
      setOwners(data);

      setMessage("");
      setLoading(false);
    } catch (error) {
      console.error("Error fetching owners:", error);
      setMessage("");
      setLoading(false);
    } finally {
      setMessage("");
      setLoading(false);
    }
  };

  const changeOwnerForm = useCallback(
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      const { name, value } = e.target;

      setOwnerForm((prev) => {
        // 1. จัดการกรณี "เบอร์โทรศัพท์" (กรองเฉพาะตัวเลข และไม่เกิน 10 หลัก)
        if (name === "phone") {
          const onlyNums = value.replace(/[^0-9]/g, "");
          if (onlyNums.length <= 10) {
            return { ...prev, [name]: onlyNums };
          }
          return prev; // ถ้าเกิน 10 หลัก ไม่ต้องอัปเดต
        }

        // 2. จัดการฟิลด์ทั่วไป (ชื่อ, นามสกุล, ฯลฯ)
        return {
          ...prev,
          [name]: value,
        };
      });
    },
    [],
  );

  const changeAddressField = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      const key = name as keyof AddressFields;
      if (key === "postalCode") {
        const onlyNums = value.replace(/[^0-9]/g, "");
        if (onlyNums.length <= 5) {
          setAddressFields((prev) => ({ ...prev, postalCode: onlyNums }));
          setAddressErrors((prev) => ({ ...prev, postalCode: "" }));
        }
        return;
      }
      setAddressFields((prev) => ({ ...prev, [key]: value }));
      setAddressErrors((prev) => ({ ...prev, [key]: "" }));
    },
    [],
  );

  const blurAddressField = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const key = e.target.name as keyof AddressFields;
      const value = e.target.value;
      const cfg = ADDRESS_FIELDS_CONFIG.find((c) => c.key === key);
      if (!cfg || !cfg.required) return;
      let error = "";
      if (!value.trim()) {
        error = cfg.errorMsg;
      } else if (key === "postalCode" && !/^\d{5}$/.test(value)) {
        error = "กรุณากรอกรหัสไปรษณีย์ 5 หลัก";
      }
      setAddressErrors((prev) => ({ ...prev, [key]: error }));
    },
    [],
  );

  const validateAddressFields = useCallback((): boolean => {
    const isLegacyMode =
      isEditingOwner &&
      !addressFields.subdistrict.trim() &&
      !addressFields.district.trim() &&
      !addressFields.province.trim() &&
      !addressFields.postalCode.trim();
    const errors: Partial<Record<keyof AddressFields, string>> = {};
    let hasError = false;
    for (const cfg of ADDRESS_FIELDS_CONFIG) {
      if (!cfg.required) continue;
      if (isLegacyMode && cfg.key !== "houseNumber") continue;
      const value = addressFields[cfg.key];
      if (!value.trim()) {
        errors[cfg.key] = cfg.errorMsg;
        hasError = true;
      } else if (cfg.key === "postalCode" && !/^\d{5}$/.test(value)) {
        errors[cfg.key] = "กรุณากรอกรหัสไปรษณีย์ 5 หลัก";
        hasError = true;
      }
    }
    if (hasError) {
      setAddressErrors(errors);
      const firstErrorKey = ADDRESS_FIELDS_CONFIG.find(
        (cfg) => errors[cfg.key],
      )?.key;
      if (firstErrorKey) {
        addressRefs.current[firstErrorKey]?.focus();
      }
    }
    return hasError;
  }, [addressFields, isEditingOwner]);

  const changePetForm = useCallback(
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      const { name, value } = e.target;
      setPetForm((prev) => ({
        ...prev,
        [name]: value,
      }));
    },
    [],
  );

  const validateForm = (ownerForm: FormOwnerProp) => {
    if (!ownerForm.firstName?.trim() || !ownerForm.lastName?.trim()) {
      showToast.error("กรุณากรอกชื่อและนามสกุล");
      return true;
    }

    // 2. ตรวจสอบเบอร์โทรศัพท์ (ตัวเลข 10 หลัก)
    if (!/^[0-9]{10}$/.test(ownerForm.phone)) {
      showToast.error("กรุณาตรวจสอบเบอร์โทรศัพท์ให้ครบ 10 หลัก");
      return true;
    }

    // 3. ตรวจสอบ Email (ใช้ Regex สำหรับ Email มาตรฐาน)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (ownerForm.email && !emailRegex.test(ownerForm.email)) {
      showToast.error("รูปแบบอีเมลไม่ถูกต้อง");
      return true;
    }

    return false;
  };

  // เพิ่มเจ้าของใหม่
  const addOwner = async () => {
    if (validateForm(ownerForm)) return;
    if (validateAddressFields()) return;
    if (isDuplicateName) {
      showToast.info("มีชื่อนี้ซ้ำอยู่ในระบบ");
      return;
    }

    try {
      if (isEditingOwner) {
        const isLegacyMode =
          !addressFields.subdistrict.trim() &&
          !addressFields.district.trim() &&
          !addressFields.province.trim() &&
          !addressFields.postalCode.trim();
        const payload: PayloadUpdateOwner = {
          id: ownerForm.id ?? "",
          address: isLegacyMode
            ? addressFields.houseNumber
            : buildAddressString(addressFields),
          email: ownerForm.email,
          firstName: ownerForm.firstName,
          lastName: ownerForm.lastName,
          phone: ownerForm.phone,
        };

        setLoading(true);
        setMessage("กําลังแก้ไขข้อมูลเจ้าของ...");
        const resp = await PutUpdateOwner(payload);

        if (!resp.success) {
          setLoading(false);
          setMessage("");
          setTimeout(() => {
            showToast.error(resp ? resp : "เกิดข้อผิดพลาดในการแก้ไขเจ้าของ");
          }, 1000);

          return;
        }

        setTimeout(async () => {
          resetOwnerForm();
          setShowCreateOwnerForm(false);
          await fetchDataOwners();
        }, 1500);
      } else {
        const payload: PayloadCreatedOwner = {
          ...ownerForm,
          address: buildAddressString(addressFields),
          veterinarianId: userLogin?.id ?? "",
          hospitalId: userLogin?.hospitalId || "",
        };

        setLoading(true);
        setMessage("กําลังเพิ่มข้อมูลเจ้าของ...");

        const resp = await PostCreatedOwner(payload);

        if (!resp.success) {
          setLoading(false);
          setMessage("");
          setTimeout(() => {
            showToast.error(resp ? resp : "เกิดข้อผิดพลาดในการเพิ่มเจ้าของ");
          }, 1000);

          return;
        }

        setTimeout(async () => {
          resetOwnerForm();
          setShowCreateOwnerForm(false);
          await fetchDataOwners();
        }, 1500);
      }
    } catch (error) {
      showToast.error("เกิดข้อผิดพลาดในการดำเนินการ");
      setLoading(false);
      setMessage("");
    }
  };

  // === Filter Owner === //
  const filteredOwners = useMemo(() => {
    const term = toLowerStr(searchTerm).trim();
    if (!term) return owners;

    return owners.filter((owner) => {
      const firstName = toLowerStr(owner.firstName);
      const lastName = toLowerStr(owner.lastName);
      const email = toLowerStr(owner.email);
      const phone = String(owner.phone ?? "");

      return (
        firstName.includes(term) ||
        lastName.includes(term) ||
        phone.includes(term) ||
        email.includes(term)
      );
    });
  }, [owners, searchTerm]);

  // ===== Pagination Owner =====
  const [currentOwnerPage, setCurrentOwnerPage] = useState(1);
  const ownerPerPage = 5;
  const totalOwnerPage = Math.ceil(filteredOwners.length / ownerPerPage);
  const startIndexOwner = (currentOwnerPage - 1) * ownerPerPage;
  const currentOwners = filteredOwners.slice(
    startIndexOwner,
    startIndexOwner + ownerPerPage,
  );

  useEffect(() => {
    setCurrentOwnerPage(1);
  }, [searchTerm]);

  // แก้ไขเจ้าของ
  const editOwner = (owner: FormOwnerProp) => {
    setOwnerForm({
      ...owner,
    });
    setIsEditingOwner(true);
    // Pre-fill address: put existing address string in houseNumber for legacy migration
    setAddressFields({
      houseNumber: owner.address || "",
      road: "",
      subdistrict: "",
      district: "",
      province: "",
      postalCode: "",
    });
    setAddressErrors({});
  };

  // ลบเจ้าของ
  const removeOwner = async (owner: FormOwnerProp) => {
    if (!owner.id) {
      showToast.error("เกิดข้อผิดพลาดในการลบเจ้าของ");
      return;
    }
    try {
      const isConfirm = await confirm({
        title: "ยืนยันการลบเจ้าของ",
        message:
          "คุณแน่ใจหรือไม่ว่าต้องการลบเจ้าของชื่อ: " + (owner.firstName || ""),
        confirmText: "ยืนยัน",
        cancelText: "ยกเลิก",
        danger: true,
      });
      if (!isConfirm) return;

      setLoading(true);
      setMessage("กําลังลบข้อมูลเจ้าของ...");
      const resp = await DeleteOwner(owner.id);
      if (!resp.success) {
        showToast.error(resp);
        setLoading(false);
        setMessage("");
        return;
      }

      setTimeout(async () => {
        setLoading(false);
        setMessage("");
        await fetchDataOwners();
      }, 2000);
    } catch (error) {
      showToast.error("เกิดข้อผิดพลาดในการลบเจ้าของ");
      setLoading(false);
      setMessage("");
    }
  };

  // รีเซ็ตฟอร์มเจ้าของ
  const resetOwnerForm = () => {
    setOwnerForm({
      id: "",
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      address: "",
    });
    setAddressFields({
      houseNumber: "",
      road: "",
      subdistrict: "",
      district: "",
      province: "",
      postalCode: "",
    });
    setAddressErrors({});
    setIsEditingOwner(false);
  };

  const isValidAge = (age: string): boolean => {
    const cleanedAge = age.trim();
    if (!cleanedAge) return false;

    const hasYear = cleanedAge.includes("ปี");
    const hasMonth = cleanedAge.includes("เดือน");

    if (!hasYear && !hasMonth) {
      return false;
    }
    const stripped = cleanedAge
      .replace(/ปี/g, "")
      .replace(/เดือน/g, "")
      .replace(/\s/g, "");

    if (stripped === "" || !/^\d+$/.test(stripped)) {
      return false;
    }

    return true;
  };

  const validatePetForm = (petForm: FormPetProp) => {
    if (!petForm.name?.trim()) {
      showToast.error("กรุณากรอกชื่อสัตว์");
      return true;
    }

    if (!petForm.breed?.trim()) {
      showToast.error("กรุณากรอกสายพันธุ์");
      return true;
    }

    if (!petForm.color?.trim()) {
      showToast.error("กรุณากรอกสี");
      return true;
    }

    if (!petForm.sex?.trim()) {
      showToast.error("กรุณากรอกเพศ");
      return true;
    }
    if (!petForm.age?.trim()) {
      showToast.error("กรุณากรอกอายุ");
      return true;
    }
    if (!isValidAge(petForm.age)) {
      showToast.error(
        "รูปแบบอายุไม่ถูกต้อง กรุณากรอก เช่น '1 ปี 2 เดือน', '3 ปี', หรือ '4 เดือน'",
      );
      return true;
    }

    if (!petForm.sterilization?.trim()) {
      showToast.error("กรุณากรอกประวัติการทำหมัน");
      return true;
    }

    if (!petForm.species?.trim()) {
      showToast.error("กรุณากรอกประเภทสัตว์");
      return true;
    } else {
      if (petForm.species === "Exotic") {
        if (!petForm.exoticdescription?.trim()) {
          showToast.error("กรุณากรอกรายละเอียดสัตว์ เช่น นก เต๋า อื่นๆ");
          return true;
        }
      }
    }
    return false;
  };

  // เพิ่มหรืออัปเดตสัตว์
  const addPet = async (ownerId: string) => {
    if (!ownerId) return showToast.error("กรุณาเลือกเจ้าของ");
    if (validatePetForm(petForm)) return;

    try {
      if (editingPetId) {
        const payload: FormPetProp = {
          ...petForm,
          ownerId: ownerId,
        };

        setLoading(true);
        setMessage("กําลังแก้ไขข้อมูลสัตว์...");
        const resp = await PutUpdatePet(payload);

        if (!resp.success) {
          setLoading(false);
          setMessage("");
          setTimeout(() => {
            showToast.error(resp ? resp : "เกิดข้อผิดพลาดในการแก้ไขสัตว์");
          }, 1500);
          return;
        }

        setTimeout(async () => {
          await fetchDataOwners();
          resetPetForm();
          setLoading(false);
          setMessage("");
          setShowCreatePetForm(false);
          setEditingPetId("");
        }, 1000);
      } else {
        const payload: FormPetProp = {
          ...petForm,
          ownerId: ownerId,
        };

        setLoading(true);
        setMessage("กําลังเพิ่มข้อมูลสัตว์...");

        const resp = await PostCreatedPet(payload);

        if (!resp.success) {
          setLoading(false);
          setMessage("");
          setTimeout(() => {
            showToast.error(resp ? resp : "เกิดข้อผิดพลาดในการเพิ่มสัตว์");
          }, 1500);
          return;
        }

        setTimeout(async () => {
          await fetchDataOwners();
          resetPetForm();
          setLoading(false);
          setMessage("");
          setShowCreatePetForm(false);
        }, 1000);
      }
    } catch (error) {
      showToast.error("เกิดข้อผิดพลาดในการดำเนินการ");
      setLoading(false);
      setMessage("");
    }
  };
  // แก้ไขสัตว์
  const editPet = async (ownerId: string, pet: FormPetProp) => {
    try {
      if (!ownerId) return showToast.error("กรุณาเลือกเจ้าของ");
      setEditingPetId(pet.id ?? "");
      setPetForm({
        ...pet,
      });
    } catch (error) {
      showToast.error("เกิดข้อผิดพลาดในการแก้ไขสัตว์");
    }
  };

  // ลบสัตว์
  const removePet = async (pet: FormPetProp) => {
    if (!pet.id) {
      showToast.error("เกิดข้อผิดพลาดในการลบสัตว์");
      return;
    }
    try {
      const isConfirmed = await confirm({
        title: "ยืนยันการลบสัตว์",
        message: "คุณต้องการลบสัตว์นี้หรือไม่?" + "\n" + (pet.name || ""),
        confirmText: "ยืนยัน",
        cancelText: "ยกเลิก",
      });

      if (!isConfirmed) return;

      setLoading(true);
      setMessage("กําลังลบข้อมูลสัตว์...");
      const resp = await DeletePet(pet.id);

      if (!resp.success) {
        showToast.error(resp);
        setLoading(false);
        setMessage("");
        return;
      }

      setTimeout(async () => {
        setLoading(false);
        setMessage("");
        await fetchDataOwners();
      }, 2000);
    } catch (error) {
      showToast.error("เกิดข้อผิดพลาดในการลบสัตว์");
      setLoading(false);
      setMessage("");
    }
  };

  // รีเซ็ตฟอร์มสัตว์
  const resetPetForm = () => {
    setPetForm({
      id: "",
      ownerId: "",
      name: "",
      color: "",
      sex: "M",
      weight: "",
      age: "",
      sterilization: "UNKNOWN",
      species: "Dog",
      exoticdescription: "",
      breed: "",
    });
    setEditingPetId("");
  };

  const isEditing = Boolean(editingPetId);

  const handleClick = () => {
    if (isEditing) return; // ป้องกันการสลับฟอร์มระหว่างกำลังแก้ไข
    setShowCreatePetForm((prev) => !prev);
  };

  const icon = isEditing ? "edit" : showCreatePetForm ? "close" : "add_circle";
  const label = isEditing
    ? "แก้ไขข้อมูลสัตว์ป่วย"
    : showCreatePetForm
      ? "ซ่อนฟอร์มเพิ่มสัตว์"
      : "เพิ่มสัตว์ป่วย";

  if (loading) {
    return <LoadingForm text={message} />;
  }

  return (
    <div className="p-6 space-y-6  min-h-screen">
      {/* Confirm Modal */}
      {ConfirmModal}
      {/* Toast Notification */}
      <ToastContainer
        position="top-right"
        autoClose={1000}
        hideProgressBar={false}
        closeOnClick
        pauseOnHover
        draggable
        theme="light"
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600">
                pets
              </span>
              ข้อมูลสัตว์ป่วยและเจ้าของ
            </h1>
            <p className="text-gray-600 mt-1">
              จัดการข้อมูลเจ้าของสัตว์และสัตว์ป่วยในระบบ
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PlugIcon className="text-gray-600" />
          <span className=" text-teal-800 font-bold">เพิ่มข้อมูลเจ้าของ:</span>
          {showCreateOwnerForm ? (
            <button
              onClick={() => {
                setShowCreateOwnerForm(false);
                resetOwnerForm();
              }}
              className="bg-teal-50 text-teal-800 hover:bg-teal-100 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 cursor-pointer border border-teal-200"
            >
              <ArrowBigUp className="text-sm" />
            </button>
          ) : (
            <button
              onClick={() => setShowCreateOwnerForm(true)}
              className="bg-teal-50 text-teal-800 hover:bg-teal-100 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 cursor-pointer border border-teal-200"
            >
              <ArrowBigDown className="text-sm" />
            </button>
          )}
          <div className="bg-blue-50 text-blue-800 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">group</span>
            {owners.length}
          </div>
        </div>
      </div>

      {/* ฟอร์มเพิ่ม/แก้ไขเจ้าของ */}
      {showCreateOwnerForm && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600">
                {isEditingOwner ? "edit" : "person_add"}
              </span>
              {isEditingOwner ? "แก้ไขข้อมูลเจ้าของ" : "เพิ่มข้อมูลเจ้าของ"}
            </h2>

            {/* Important Note Badge */}
            <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg border border-blue-100">
              <span className="material-symbols-outlined text-blue-600 text-lg">
                info
              </span>
              <span className="text-sm text-blue-700 font-medium">
                ข้อมูลเจ้าของใช้สำหรับลงนามในระบบ
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ชื่อ <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="กรอกชื่อจริง"
                name="firstName"
                value={ownerForm.firstName || ""}
                onChange={changeOwnerForm}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                นามสกุล <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="กรอกนามสกุล"
                name="lastName"
                value={ownerForm.lastName}
                onChange={changeOwnerForm}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                เบอร์โทรศัพท์ <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="phone"
                placeholder="กรอกเบอร์โทรศัพท์"
                value={ownerForm.phone}
                onChange={changeOwnerForm}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                placeholder="กรอกอีเมล (ถ้ามี)"
                value={ownerForm.email}
                onChange={changeOwnerForm}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            {/* ─── ที่อยู่ (แยกช่อง) ─── */}
            <div className="md:col-span-4 space-y-3">
              {/* Header + Summary Banner */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-gray-700">
                  ที่อยู่ <span className="text-red-500">*</span>
                </span>
                {incompleteAddressFields.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-medium">ที่อยู่ยังไม่ครบ:</span>
                    {incompleteAddressFields.map((cfg, i) => (
                      <button
                        key={cfg.key}
                        type="button"
                        onClick={() => addressRefs.current[cfg.key]?.focus()}
                        className="underline decoration-dotted text-amber-800 hover:text-amber-900 font-medium"
                      >
                        {cfg.label}
                        {i < incompleteAddressFields.length - 1 ? "," : ""}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Legacy address migration notice (edit mode) */}
              {isEditingOwner &&
                addressFields.houseNumber &&
                !addressFields.subdistrict &&
                !addressFields.district &&
                !addressFields.province &&
                !addressFields.postalCode && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                    <span className="material-symbols-outlined text-base text-blue-500">
                      info
                    </span>
                    <span>
                      ที่อยู่เดิมถูกใส่ไว้ในช่อง <strong>เลขที่บ้าน</strong>{" "}
                      สามารถล้างและกรอกแยกช่องเพื่อความถูกต้องได้
                    </span>
                  </div>
                )}

              {/* Row 1: เลขที่บ้าน | ถนน */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* เลขที่บ้าน */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    เลขที่บ้าน <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      ref={(el) => {
                        addressRefs.current.houseNumber = el;
                      }}
                      type="text"
                      name="houseNumber"
                      placeholder="เช่น 123/4 หมู่ 5"
                      value={addressFields.houseNumber}
                      onChange={changeAddressField}
                      onBlur={blurAddressField}
                      className={`w-full border rounded-lg px-4 py-2.5 focus:ring-2 outline-none transition-all ${
                        addressErrors.houseNumber
                          ? "border-red-400 focus:ring-red-400/30 focus:border-red-400 bg-red-50 pr-9"
                          : "border-gray-300 focus:ring-blue-500/30 focus:border-blue-500"
                      }`}
                    />
                    {addressErrors.houseNumber && (
                      <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500 pointer-events-none" />
                    )}
                  </div>
                  {addressErrors.houseNumber && (
                    <p className="mt-1 text-xs text-red-600">
                      {addressErrors.houseNumber}
                    </p>
                  )}
                </div>

                {/* ถนน */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    ถนน{" "}
                    <span className="text-xs text-gray-400 font-normal">
                      (ไม่บังคับ)
                    </span>
                  </label>
                  <input
                    ref={(el) => {
                      addressRefs.current.road = el;
                    }}
                    type="text"
                    name="road"
                    placeholder="เช่น สุขุมวิท"
                    value={addressFields.road}
                    onChange={changeAddressField}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Row 2: ตำบล/แขวง | อำเภอ/เขต */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* ตำบล/แขวง */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    ตำบล/แขวง <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      ref={(el) => {
                        addressRefs.current.subdistrict = el;
                      }}
                      type="text"
                      name="subdistrict"
                      placeholder="เช่น คลองตัน"
                      value={addressFields.subdistrict}
                      onChange={changeAddressField}
                      onBlur={blurAddressField}
                      className={`w-full border rounded-lg px-4 py-2.5 focus:ring-2 outline-none transition-all ${
                        addressErrors.subdistrict
                          ? "border-red-400 focus:ring-red-400/30 focus:border-red-400 bg-red-50 pr-9"
                          : "border-gray-300 focus:ring-blue-500/30 focus:border-blue-500"
                      }`}
                    />
                    {addressErrors.subdistrict && (
                      <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500 pointer-events-none" />
                    )}
                  </div>
                  {addressErrors.subdistrict && (
                    <p className="mt-1 text-xs text-red-600">
                      {addressErrors.subdistrict}
                    </p>
                  )}
                </div>

                {/* อำเภอ/เขต */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    อำเภอ/เขต <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      ref={(el) => {
                        addressRefs.current.district = el;
                      }}
                      type="text"
                      name="district"
                      placeholder="เช่น คลองเตย"
                      value={addressFields.district}
                      onChange={changeAddressField}
                      onBlur={blurAddressField}
                      className={`w-full border rounded-lg px-4 py-2.5 focus:ring-2 outline-none transition-all ${
                        addressErrors.district
                          ? "border-red-400 focus:ring-red-400/30 focus:border-red-400 bg-red-50 pr-9"
                          : "border-gray-300 focus:ring-blue-500/30 focus:border-blue-500"
                      }`}
                    />
                    {addressErrors.district && (
                      <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500 pointer-events-none" />
                    )}
                  </div>
                  {addressErrors.district && (
                    <p className="mt-1 text-xs text-red-600">
                      {addressErrors.district}
                    </p>
                  )}
                </div>
              </div>

              {/* Row 3: จังหวัด | รหัสไปรษณีย์ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* จังหวัด */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    จังหวัด <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      ref={(el) => {
                        addressRefs.current.province = el;
                      }}
                      type="text"
                      name="province"
                      placeholder="เช่น กรุงเทพมหานคร"
                      value={addressFields.province}
                      onChange={changeAddressField}
                      onBlur={blurAddressField}
                      className={`w-full border rounded-lg px-4 py-2.5 focus:ring-2 outline-none transition-all ${
                        addressErrors.province
                          ? "border-red-400 focus:ring-red-400/30 focus:border-red-400 bg-red-50 pr-9"
                          : "border-gray-300 focus:ring-blue-500/30 focus:border-blue-500"
                      }`}
                    />
                    {addressErrors.province && (
                      <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500 pointer-events-none" />
                    )}
                  </div>
                  {addressErrors.province && (
                    <p className="mt-1 text-xs text-red-600">
                      {addressErrors.province}
                    </p>
                  )}
                </div>

                {/* รหัสไปรษณีย์ */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    รหัสไปรษณีย์ <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      ref={(el) => {
                        addressRefs.current.postalCode = el;
                      }}
                      type="text"
                      name="postalCode"
                      placeholder="เช่น 10110"
                      maxLength={5}
                      value={addressFields.postalCode}
                      onChange={changeAddressField}
                      onBlur={blurAddressField}
                      className={`w-full border rounded-lg px-4 py-2.5 focus:ring-2 outline-none transition-all ${
                        addressErrors.postalCode
                          ? "border-red-400 focus:ring-red-400/30 focus:border-red-400 bg-red-50 pr-9"
                          : "border-gray-300 focus:ring-blue-500/30 focus:border-blue-500"
                      }`}
                    />
                    {addressErrors.postalCode && (
                      <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500 pointer-events-none" />
                    )}
                  </div>
                  {addressErrors.postalCode && (
                    <p className="mt-1 text-xs text-red-600">
                      {addressErrors.postalCode}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {isDuplicateName && (
            <div className="mt-2 md:col-span-4">
              <div
                role="status"
                aria-live="polite"
                className="p-2 rounded-md bg-amber-50 border border-amber-100 text-amber-700 text-sm"
              >
                มีชื่อนี้ซ้ำอยู่ในระบบ
              </div>
            </div>
          )}

          {/* Medical Certificate Note Section */}
          <div className="mt-4 p-4 bg-linear-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="shrink-0">
                <span className="material-symbols-outlined text-blue-600 text-2xl">
                  description
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-blue-800">
                    หมายเหตุสำคัญ:
                  </span>
                  <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                    จำเป็นต้องกรอกให้ครบถ้วน
                  </span>
                </div>

                <div className="text-sm text-gray-700 space-y-1">
                  <p className="flex items-start gap-2">
                    <span className="text-blue-600">•</span>
                    <span>
                      ข้อมูลเจ้าของจะถูกนำไปใช้ในการ{" "}
                      <strong className="text-blue-800">
                        ลงนามในใบนัดหมาย
                      </strong>{" "}
                      ทุกครั้ง
                    </span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-blue-600">•</span>
                    <span>
                      กรุณาตรวจสอบความถูกต้องของชื่อ-นามสกุล
                      ให้ตรงกับบัตรประชาชน
                    </span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-blue-600">•</span>
                    <span>
                      เบอร์โทรศัพท์และอีเมลใช้สำหรับ{" "}
                      <strong className="text-blue-800">ส่งใบนัดหมาย</strong>{" "}
                      และ{" "}
                      <strong className="text-blue-800">
                        แจ้งเตือนการนัดหมาย
                      </strong>
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={addOwner}
              className="bg-linear-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl flex items-center gap-2 hover:shadow-lg transition-all shadow-sm hover:shadow-blue-200"
            >
              <span className="material-symbols-outlined">save</span>
              {isEditingOwner ? "อัปเดตเจ้าของ" : "เพิ่มเจ้าของ"}
            </motion.button>

            {isEditingOwner && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  resetOwnerForm();
                  setShowCreateOwnerForm(false);
                }}
                className="bg-gray-500 text-white px-6 py-3 rounded-xl flex items-center gap-2 hover:bg-gray-600 transition-all"
              >
                <span className="material-symbols-outlined">cancel</span>
                ยกเลิก
              </motion.button>
            )}
          </div>

          {/* Footer Note */}
          <div className="text-xs text-gray-400 flex items-center gap-1 pt-2 border-t border-gray-100">
            <span className="material-symbols-outlined text-base">
              verified
            </span>
            <span>
              ข้อมูลทั้งหมดถูกเก็บเป็นความลับ
              และใช้เฉพาะในการออกเอกสารทางการแพทย์เท่านั้น
            </span>
          </div>
        </motion.div>
      )}

      {/* ตารางแสดงข้อมูล */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 border-b border-gray-100"
        >
          {/* Title */}
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">
              list
            </span>
            รายชื่อเจ้าของ
          </h2>

          {/* Search Bar */}
          <motion.div
            layout
            className="flex items-center w-full sm:w-96 lg:w-xl bg-gray-100 px-4 py-2.5 rounded-xl focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:bg-white transition-all"
          >
            <span className="material-symbols-outlined text-gray-400 text-lg">
              search
            </span>
            <input
              type="text"
              placeholder="ค้นหาเจ้าของ (ชื่อ, นามสกุล, เบอร์, อีเมล)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 outline-none text-sm bg-transparent px-2"
            />
            {searchTerm && (
              <motion.button
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                onClick={() => setSearchTerm("")}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="material-symbols-outlined text-base">
                  close
                </span>
              </motion.button>
            )}
          </motion.div>
        </motion.div>

        {filteredOwners.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <span className="material-symbols-outlined text-4xl opacity-50 mb-3">
              group_off
            </span>
            <p>ยังไม่มีข้อมูลเจ้าของ</p>
            <p className="text-sm">เริ่มต้นโดยการเพิ่มข้อมูลเจ้าของด้านบน</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {currentOwners.map((owner: any, index) => (
              <motion.div
                key={owner.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
                className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50 transition-colors"
              >
                <div className="p-4 md:p-6">
                  {/* Header Section */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Owner Info - Flex Wrap */}
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Avatar + Name */}
                      <div className="flex items-center gap-3 min-w-50">
                        <div className="w-10 h-10 bg-linear-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-sm">
                          <span className="text-white font-bold">
                            {owner.firstName?.charAt(0) || "A"}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {owner.firstName} {owner.lastName}
                          </h3>
                          <p className="text-xs text-gray-500">
                            ID: {owner.id?.slice(-8)}
                          </p>
                        </div>
                      </div>

                      {/* Contact Info - Wrap อัตโนมัติ */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Phone */}
                        <div className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full text-xs flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-gray-500 text-sm">
                            call
                          </span>
                          <span>{owner.phone || "ไม่มีเบอร์"}</span>
                        </div>

                        {/* Email */}
                        <div className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full text-xs flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-gray-500 text-sm">
                            email
                          </span>
                          <span className="max-w-150 truncate">
                            {owner.email || "ไม่มีอีเมล"}
                          </span>
                        </div>

                        {/* Address */}
                        <div className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full text-xs flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-gray-500 text-sm">
                            location_on
                          </span>
                          <span className="max-w-150 truncate">
                            {owner.address || "ไม่มีที่อยู่"}
                          </span>
                        </div>

                        {/* Pet Count */}
                        <div className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-xs flex items-center gap-1.5 font-medium">
                          <span className="material-symbols-outlined text-blue-500 text-sm">
                            pets
                          </span>
                          <span>{(owner.animals || []).length} ตัว</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 ml-auto">
                      {/* Expand Button */}
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setExpandedOwner(
                            expandedOwner === owner?.id ? "" : owner.id,
                          );

                          setShowCreatePetForm(false);
                          resetPetForm();
                        }}
                        className="p-2 text-gray-600 items-center flex text-xs gap-x-2 hover:bg-blue-50 rounded-lg transition-colors"
                        title={
                          expandedOwner === owner.id
                            ? "ซ่อนรายละเอียด"
                            : "ดูรายละเอียด"
                        }
                      >
                        {expandedOwner === owner.id ? "ซ่อน" : "ดูรายละเอียด"}
                        <span className="material-symbols-outlined text-lg">
                          {expandedOwner === owner.id
                            ? "expand_less"
                            : "expand_more"}
                        </span>
                      </motion.button>

                      {/* Edit Button */}
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          editOwner(owner);
                          setShowCreateOwnerForm(true);
                        }}
                        className="p-2 text-gray-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title="แก้ไขข้อมูลเจ้าของ"
                      >
                        <span className="material-symbols-outlined text-lg">
                          edit
                        </span>
                      </motion.button>

                      {/* Delete Button (เฉพาะไม่มีสัตว์) */}
                      {(owner.animals || []).length === 0 && (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => removeOwner(owner)}
                          className="p-2 text-gray-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="ลบเจ้าของ"
                        >
                          <span className="material-symbols-outlined text-lg">
                            delete
                          </span>
                        </motion.button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  <AnimatePresence>
                    {expandedOwner === owner.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="mt-4 space-y-4 overflow-hidden"
                      >
                        {/* Pet Form */}
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                          {/* Header - Toggle Form */}

                          <button
                            type="button"
                            onClick={handleClick}
                            disabled={isEditing}
                            className="flex items-center justify-center cursor-pointer group gap-2 disabled:cursor-not-allowed"
                            aria-disabled={isEditing}
                            title={
                              isEditing ? "กำลังแก้ไขข้อมูลอยู่" : undefined
                            }
                          >
                            <h4 className="font-medium text-gray-700 flex items-center gap-2">
                              <span
                                className={`material-symbols-outlined text-base transition-colors ${
                                  isEditing
                                    ? "text-blue-600"
                                    : showCreatePetForm
                                      ? "text-gray-500"
                                      : "text-green-600"
                                }`}
                              >
                                {icon}
                              </span>
                              <span
                                className={`transition-colors ${
                                  isEditing
                                    ? "text-blue-700"
                                    : showCreatePetForm
                                      ? "text-gray-600"
                                      : "text-green-700 group-hover:text-green-800"
                                }`}
                              >
                                {label}
                              </span>
                            </h4>
                          </button>

                          {/* Form Content - Conditional */}
                          {showCreatePetForm && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.15 }}
                            >
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-200">
                                {/* ชื่อสัตว์ */}
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1  items-center gap-1">
                                    ชื่อสัตว์
                                    <span className="text-red-500">*</span>
                                  </label>
                                  <input
                                    type="text"
                                    name="name"
                                    placeholder="ชื่อสัตว์"
                                    value={petForm.name}
                                    onChange={changePetForm}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                                  />
                                </div>

                                {/* สี */}
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">
                                    สี
                                  </label>
                                  <input
                                    type="text"
                                    name="color"
                                    placeholder="สี"
                                    value={petForm.color}
                                    onChange={changePetForm}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                                  />
                                </div>

                                {/* ชนิด */}
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1  items-center gap-1">
                                    ชนิด
                                    <span className="text-red-500">*</span>
                                  </label>
                                  <select
                                    name="species"
                                    value={petForm.species}
                                    onChange={changePetForm}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                                  >
                                    <option value="Dog">สุนัข</option>
                                    <option value="Cat">แมว</option>
                                    <option value="Exotic">
                                      สัตว์ชนิดพิเศษ
                                    </option>
                                  </select>

                                  {petForm.species === "Exotic" && (
                                    <motion.div
                                      initial={{ opacity: 0, y: -5 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{ duration: 0.15 }}
                                      className="mt-2"
                                    >
                                      <input
                                        type="text"
                                        name="exoticdescription"
                                        placeholder="ระบุชนิดสัตว์พิเศษ"
                                        value={petForm.exoticdescription}
                                        onChange={changePetForm}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                                      />
                                    </motion.div>
                                  )}
                                </div>

                                {/* สายพันธุ์ */}
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">
                                    สายพันธุ์
                                  </label>
                                  <input
                                    type="text"
                                    name="breed"
                                    placeholder="เช่น พุดเดิ้ล"
                                    value={petForm.breed}
                                    onChange={changePetForm}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                                  />
                                </div>

                                {/* เพศ */}
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">
                                    เพศ
                                  </label>
                                  <select
                                    name="sex"
                                    value={petForm.sex}
                                    onChange={changePetForm}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                                  >
                                    <option value="M">ผู้</option>
                                    <option value="F">เมีย</option>
                                  </select>
                                </div>

                                {/* ทำหมัน */}
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">
                                    ทำหมัน
                                  </label>
                                  <select
                                    name="sterilization"
                                    value={petForm.sterilization}
                                    onChange={changePetForm}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                                  >
                                    <option value="YES">ทำหมันแล้ว</option>
                                    <option value="NO">ยังไม่ทำหมัน</option>
                                    <option value="UNKNOWN">ไม่ทราบ</option>
                                  </select>
                                </div>

                                {/* อายุ */}
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">
                                    อายุ <span className="text-red-500">*</span>
                                  </label>
                                  <input
                                    type="text"
                                    name="age"
                                    placeholder="เช่น 1 ปี 2 เดือน"
                                    value={petForm.age}
                                    onChange={changePetForm}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                                  />
                                  <p className="text-xs text-gray-500 mt-1 px-1">
                                    ต้องมี 'ปี' หรือ 'เดือน' ต่อท้ายตัวเลข
                                  </p>
                                </div>

                                {/* น้ำหนัก */}
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">
                                    น้ำหนัก (กก.)
                                  </label>
                                  <input
                                    type="text"
                                    name="weight"
                                    placeholder="5.5"
                                    value={petForm.weight || ""}
                                    onChange={changePetForm}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                                  />
                                </div>
                              </div>

                              {/* Form Buttons */}
                              <div className="flex items-center gap-2 mt-4 pt-2">
                                <motion.button
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() => addPet(owner.id || "")}
                                  className="bg-linear-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm flex items-center gap-2 shadow-sm transition-all"
                                >
                                  <span className="material-symbols-outlined text-sm">
                                    {editingPetId ? "save" : "add"}
                                  </span>
                                  {editingPetId
                                    ? "บันทึกการแก้ไข"
                                    : "เพิ่มสัตว์"}
                                </motion.button>

                                {editingPetId && (
                                  <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => {
                                      resetPetForm();
                                      setEditingPetId("");
                                      setShowCreatePetForm(false);
                                    }}
                                    className="bg-white hover:bg-gray-50 text-gray-700 px-5 py-2.5 rounded-lg text-sm flex items-center gap-2 border border-gray-300 shadow-sm transition-all"
                                  >
                                    <span className="material-symbols-outlined text-sm">
                                      close
                                    </span>
                                    ยกเลิก
                                  </motion.button>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </div>

                        {/* Pets Table or Empty State */}
                        {(owner.animals || []).length ? (
                          <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                            className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm"
                          >
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50">
                                {/* Header with Owner Name and Search */}
                                <tr>
                                  <th colSpan={11} className="p-4">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                      <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-blue-600 text-base">
                                          pets
                                        </span>
                                        <span className="font-medium ">
                                          <span className="text-gray-500">
                                            รายการสัตว์ของ
                                          </span>
                                          {" : "}
                                          <span className="text-cyan-600">
                                            {owner.firstName} {owner.lastName}
                                          </span>
                                        </span>
                                      </div>
                                      {/* <div className="w-full sm:w-64">
                                        <div className="relative">
                                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base">
                                            search
                                          </span>
                                          <input
                                            type="search"
                                            placeholder="ค้นหาชื่อสัตว์..."
                                            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                          />
                                        </div>
                                      </div> */}
                                    </div>
                                  </th>
                                </tr>

                                {/* Table Headers */}
                                <tr className="border-y border-gray-200 bg-gray-100/50">
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    ลำดับ
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    ชื่อสัตว์
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    สี
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    ชนิด
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    อายุ
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    สายพันธ์
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    เพศ
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    การทำหมัน
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    น้ำหนัก
                                  </th>
                                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    อัพเดท
                                  </th>
                                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                                    จัดการ
                                  </th>
                                </tr>
                              </thead>

                              <tbody className="divide-y divide-gray-200">
                                {(owner.animals || []).map(
                                  (pet: any, petIndex: number) => (
                                    <motion.tr
                                      key={pet.id}
                                      initial={{ opacity: 0, x: -5 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{
                                        duration: 0.15,
                                        delay: petIndex * 0.02,
                                      }}
                                      className="hover:bg-blue-50/30 transition-colors group"
                                    >
                                      <td className="px-4 py-3 text-gray-600">
                                        <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">
                                          {String(petIndex + 1).padStart(
                                            2,
                                            "0",
                                          )}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                          <div className="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center">
                                            <span className="material-symbols-outlined text-green-600 text-sm">
                                              pets
                                            </span>
                                          </div>
                                          <span className="font-medium text-gray-900">
                                            {pet.name || "ไม่ระบุ"}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 text-gray-600">
                                        <span className="flex items-center gap-1">
                                          <span
                                            className="w-3 h-3 rounded-full"
                                            style={{
                                              backgroundColor: pet.color
                                                ? `#${pet.color}`
                                                : "#ccc",
                                            }}
                                          />
                                          {pet.color || "-"}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3">
                                        <span
                                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                ${pet.species === "Dog" ? "bg-amber-100 text-amber-700" : ""}
                ${pet.species === "Cat" ? "bg-purple-100 text-purple-700" : ""}
                ${pet.species === "Exotic" ? "bg-emerald-100 text-emerald-700" : ""}
              `}
                                        >
                                          {pet.species === "Dog" && "🐕 สุนัข"}
                                          {pet.species === "Cat" && "🐈 แมว"}
                                          {pet.species === "Exotic" && (
                                            <>🦎 {pet.exoticdescription}</>
                                          )}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-gray-600">
                                        {pet.age ? (
                                          <span className="flex items-center gap-1">
                                            <span className="material-symbols-outlined text-sm text-gray-400">
                                              calendar_today
                                            </span>
                                            {pet.age}
                                          </span>
                                        ) : (
                                          "-"
                                        )}
                                      </td>

                                      <td className="px-4 py-3 text-gray-600">
                                        {pet.breed ? (
                                          <span className="flex items-center gap-1">
                                            <span className="material-symbols-outlined text-sm text-gray-400">
                                              emoji_nature
                                            </span>
                                            {pet.breed}
                                          </span>
                                        ) : (
                                          "-"
                                        )}
                                      </td>

                                      <td className="px-4 py-3 text-gray-600">
                                        {pet.sex ? (
                                          <span className="flex items-center gap-1">
                                            <span className="material-symbols-outlined text-sm text-gray-400">
                                              transgender
                                            </span>
                                            {pet.sex === "M" ? "ผู้" : "เมีย"}
                                          </span>
                                        ) : (
                                          "-"
                                        )}
                                      </td>

                                      <td className="px-4 py-3 text-gray-600">
                                        {pet.sterilization ? (
                                          <span className="flex items-center gap-1">
                                            <span className="material-symbols-outlined text-sm text-gray-400">
                                              sound_detection_dog_barking
                                            </span>
                                            {pet.sterilization === "YES"
                                              ? "ทำหมัน"
                                              : pet.sterilization === "NO"
                                                ? "ไม่ทำหมัน"
                                                : "ไม่ทราบ"}
                                          </span>
                                        ) : (
                                          "-"
                                        )}
                                      </td>

                                      <td className="px-4 py-3 text-gray-600">
                                        {pet.weight ? (
                                          <span className="flex items-center gap-1">
                                            <span className="material-symbols-outlined text-sm text-gray-400">
                                              fitness_center
                                            </span>
                                            {pet.weight} กก.
                                          </span>
                                        ) : (
                                          "-"
                                        )}
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="flex justify-end">
                                          {/* Updated At Badge */}
                                          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 group-hover:bg-gray-200 transition-all">
                                            <span className="material-symbols-outlined text-sm text-gray-500">
                                              schedule
                                            </span>

                                            {(() => {
                                              const updatedAt = new Date(
                                                pet.updatedAt,
                                              );
                                              const now = new Date();
                                              const diffMs =
                                                now.getTime() -
                                                updatedAt.getTime();
                                              const diffHours =
                                                diffMs / (1000 * 60 * 60);
                                              const isNew = diffHours <= 24;

                                              // Format date for Thailand
                                              const thaiDate =
                                                updatedAt.toLocaleDateString(
                                                  "th-TH",
                                                  {
                                                    timeZone: "Asia/Bangkok",
                                                    day: "numeric",
                                                    month: "short",
                                                    year: "numeric",
                                                  },
                                                );

                                              const thaiTime =
                                                updatedAt.toLocaleTimeString(
                                                  "th-TH",
                                                  {
                                                    timeZone: "Asia/Bangkok",
                                                    hour12: false,
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                  },
                                                );

                                              return isNew ? (
                                                <motion.span
                                                  initial={{
                                                    scale: 0.9,
                                                    opacity: 0,
                                                  }}
                                                  animate={{
                                                    scale: 1,
                                                    opacity: 1,
                                                  }}
                                                  className="flex items-center gap-1 text-green-700"
                                                >
                                                  <span className="relative flex h-2 w-2">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                                  </span>
                                                  <span className="font-medium">
                                                    อัปเดตล่าสุด
                                                  </span>
                                                  <span className="text-green-600 font-mono">
                                                    {thaiTime}
                                                  </span>
                                                  <span className="text-gray-500">
                                                    น.
                                                  </span>
                                                </motion.span>
                                              ) : (
                                                <span className="flex items-center gap-1 text-gray-600">
                                                  <span className="text-gray-500">
                                                    {thaiDate}
                                                  </span>
                                                  <span className="text-gray-400">
                                                    •
                                                  </span>
                                                  <span className="font-mono text-gray-600">
                                                    {thaiTime}
                                                  </span>
                                                  <span className="text-gray-500">
                                                    น.
                                                  </span>
                                                </span>
                                              );
                                            })()}
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="flex justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                                          <motion.button
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={() => {
                                              editPet(owner.id, pet);
                                              setShowCreatePetForm(true);
                                            }}
                                            className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                            title="แก้ไขข้อมูลสัตว์"
                                          >
                                            <span className="material-symbols-outlined text-sm">
                                              edit
                                            </span>
                                          </motion.button>
                                          <motion.button
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={() => removePet(pet)}
                                            className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                            title="ลบข้อมูลสัตว์"
                                          >
                                            <span className="material-symbols-outlined text-sm">
                                              delete
                                            </span>
                                          </motion.button>
                                        </div>
                                      </td>
                                    </motion.tr>
                                  ),
                                )}
                              </tbody>

                              {/* Table Footer */}
                              <tfoot className="bg-gray-50/80">
                                <tr className="border-t border-gray-200">
                                  <td colSpan={11} className="px-4 py-3">
                                    <div className="flex justify-end items-center gap-2 text-sm">
                                      <span className="text-gray-500">
                                        จำนวนสัตว์ป่วยทั้งหมด
                                      </span>
                                      <span className="bg-blue-100 text-blue-700 font-medium px-3 py-1 rounded-full text-xs">
                                        {(owner.animals || []).length} ตัว
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </motion.div>
                        ) : (
                          <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                            className="text-center py-12 text-gray-500 bg-linear-to-br from-gray-50 to-white rounded-xl border-2 border-dashed border-gray-200"
                          >
                            <div className="flex flex-col items-center max-w-sm mx-auto">
                              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <span className="material-symbols-outlined text-4xl text-gray-300">
                                  pets
                                </span>
                              </div>
                              <p className="text-gray-700 font-medium mb-2">
                                ยังไม่มีข้อมูลสัตว์ป่วย
                              </p>
                              <p className="text-sm text-gray-400 mb-4">
                                {showCreatePetForm
                                  ? "กรอกข้อมูลด้านบนและกด 'เพิ่มสัตว์' เพื่อเพิ่มสัตว์ป่วยตัวแรก"
                                  : "คลิก 'เพิ่มสัตว์ป่วย' เพื่อเริ่มต้นเพิ่มข้อมูล"}
                              </p>
                              {!showCreatePetForm && (
                                <button
                                  onClick={() => setShowCreatePetForm(true)}
                                  className="text-blue-600 text-sm flex items-center gap-1 hover:gap-2 transition-all"
                                >
                                  <span className="material-symbols-outlined text-base">
                                    add_circle
                                  </span>
                                  เพิ่มสัตว์ป่วย
                                </button>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
            <div className="py-3 px-6 flex items-center justify-between">
              {totalOwnerPage > 1 && (
                <>
                  {/* จำนวนหน้า */}
                  <div className="text-sm text-gray-600 order-2 sm:order-1">
                    หน้าที่{" "}
                    <span className="font-medium text-blue-600">
                      {currentOwnerPage}
                    </span>{" "}
                    จาก <span className="font-medium">{totalOwnerPage}</span>
                  </div>

                  {/* Pagination Controls */}
                  <div className="flex items-center gap-2 order-1 sm:order-2">
                    {/* Previous Button */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() =>
                        setCurrentOwnerPage((prev) => Math.max(prev - 1, 1))
                      }
                      disabled={currentOwnerPage === 1}
                      className="flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-all"
                      aria-label="หน้าก่อนหน้า"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </motion.button>

                    {/* Page Numbers */}
                    <div className="flex items-center gap-1.5 mx-1">
                      {Array.from(
                        { length: Math.min(5, totalOwnerPage) },
                        (_, i) => {
                          let pageNum;
                          if (totalOwnerPage <= 5) {
                            pageNum = i + 1;
                          } else if (currentOwnerPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentOwnerPage >= totalOwnerPage - 2) {
                            pageNum = totalOwnerPage - 4 + i;
                          } else {
                            pageNum = currentOwnerPage - 2 + i;
                          }

                          return (
                            <motion.button
                              key={pageNum}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setCurrentOwnerPage(pageNum)}
                              className={`w-9 h-9 rounded-xl text-sm font-medium transition-all ${
                                currentOwnerPage === pageNum
                                  ? "bg-linear-to-tr from-cyan-500 to-blue-500 text-white shadow-sm shadow-blue-500/20"
                                  : "text-gray-600 hover:bg-gray-100 border border-transparent hover:border-gray-200"
                              }`}
                              aria-label={`ไปหน้า ${pageNum}`}
                              aria-current={
                                currentOwnerPage === pageNum
                                  ? "page"
                                  : undefined
                              }
                            >
                              {pageNum}
                            </motion.button>
                          );
                        },
                      )}
                    </div>

                    {/* Next Button */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() =>
                        setCurrentOwnerPage((prev) =>
                          Math.min(prev + 1, totalOwnerPage),
                        )
                      }
                      disabled={currentOwnerPage === totalOwnerPage}
                      className="flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-all"
                      aria-label="หน้าถัดไป"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </motion.button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
