import {
    collection,
    doc,
    addDoc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase/Firebase";

// ============================================================
// ASSIGNMENT SERVICE
// ============================================================

// ------------------------------------------------------------
// CREATE ASSIGNMENT
// ------------------------------------------------------------
export const createAssignment = async (assignmentData) => {
    try {
        const assignmentRef = await addDoc(
            collection(db, "assignments"),
            {
                ...assignmentData,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            }
        );

        return {
            id: assignmentRef.id,
            ...assignmentData,
        };
    } catch (error) {
        console.error("Error creating assignment:", error);
        throw error;
    }
};

// ------------------------------------------------------------
// GET SINGLE ASSIGNMENT
// ------------------------------------------------------------
export const getAssignment = async (assignmentId) => {
    try {
        const assignmentRef = doc(db, "assignments", assignmentId);
        const snapshot = await getDoc(assignmentRef);

        if (!snapshot.exists()) {
            return null;
        }

        return {
            id: snapshot.id,
            ...snapshot.data(),
        };
    } catch (error) {
        console.error("Error getting assignment:", error);
        throw error;
    }
};

// ------------------------------------------------------------
// GET TEACHER ASSIGNMENTS
// ------------------------------------------------------------
export const getTeacherAssignments = async (
    teacherId,
    courseId = null
) => {
    try {
        let constraints = [
            where("teacherId", "==", teacherId),
        ];

        if (courseId) {
            constraints.push(
                where("courseId", "==", courseId)
            );
        }

        const q = query(
            collection(db, "assignments"),
            ...constraints
        );

        const snapshot = await getDocs(q);

        return snapshot.docs.map((assignmentDoc) => ({
            id: assignmentDoc.id,
            ...assignmentDoc.data(),
        }));
    } catch (error) {
        console.error("Error getting teacher assignments:", error);
        throw error;
    }
};

// ------------------------------------------------------------
// UPDATE ASSIGNMENT
// ------------------------------------------------------------
export const updateAssignment = async (
    assignmentId,
    assignmentData
) => {
    try {
        const assignmentRef = doc(
            db,
            "assignments",
            assignmentId
        );

        await updateDoc(assignmentRef, {
            ...assignmentData,
            updatedAt: serverTimestamp(),
        });

        return true;
    } catch (error) {
        console.error("Error updating assignment:", error);
        throw error;
    }
};

// ------------------------------------------------------------
// PUBLISH ASSIGNMENT
// ------------------------------------------------------------
export const publishAssignment = async (assignmentId) => {
    try {
        const assignmentRef = doc(
            db,
            "assignments",
            assignmentId
        );

        await updateDoc(assignmentRef, {
            status: "published",
            publishedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        return true;
    } catch (error) {
        console.error("Error publishing assignment:", error);
        throw error;
    }
};

// ------------------------------------------------------------
// UNPUBLISH ASSIGNMENT
// ------------------------------------------------------------
export const unpublishAssignment = async (assignmentId) => {
    try {
        const assignmentRef = doc(
            db,
            "assignments",
            assignmentId
        );

        await updateDoc(assignmentRef, {
            status: "draft",
            updatedAt: serverTimestamp(),
        });

        return true;
    } catch (error) {
        console.error("Error unpublishing assignment:", error);
        throw error;
    }
};

// ------------------------------------------------------------
// DELETE ASSIGNMENT
// ------------------------------------------------------------
export const deleteAssignment = async (assignmentId) => {
    try {
        const assignmentRef = doc(
            db,
            "assignments",
            assignmentId
        );

        await deleteDoc(assignmentRef);

        return true;
    } catch (error) {
        console.error("Error deleting assignment:", error);
        throw error;
    }
};

// ------------------------------------------------------------
// GET COURSE ASSIGNMENTS
// ------------------------------------------------------------
export const getCourseAssignments = async (
    courseId,
    includeDrafts = false
) => {
    try {
        const constraints = [
            where("courseId", "==", courseId),
        ];

        if (!includeDrafts) {
            constraints.push(
                where("status", "==", "published")
            );
        }

        const q = query(
            collection(db, "assignments"),
            ...constraints
        );

        const snapshot = await getDocs(q);

        return snapshot.docs.map((assignmentDoc) => ({
            id: assignmentDoc.id,
            ...assignmentDoc.data(),
        }));
    } catch (error) {
        console.error("Error getting course assignments:", error);
        throw error;
    }
};

// ============================================================
// ASSIGNMENT SUBMISSIONS
// ============================================================

// ------------------------------------------------------------
// SUBMIT ASSIGNMENT
//
// IMPORTANT:
// Submission document ID = studentId
//
// Path:
// assignments/{assignmentId}/submissions/{studentId}
// ------------------------------------------------------------
export const submitAssignment = async (
    assignmentId,
    submissionData
) => {
    try {
        if (!assignmentId) {
            throw new Error("Assignment ID is required.");
        }

        if (!submissionData?.studentId) {
            throw new Error("Student ID is required.");
        }

        const studentId = submissionData.studentId;

        const submissionRef = doc(
            db,
            "assignments",
            assignmentId,
            "submissions",
            studentId
        );

        const existingSubmission = await getDoc(
            submissionRef
        );

        const data = {
            ...submissionData,
            studentId,

            updatedAt: serverTimestamp(),

            // Keep grading information safe when resubmitting.
            ...(existingSubmission.exists()
                ? {}
                : {
                    grade: null,
                    feedback: "",
                    gradedAt: null,
                    gradedBy: null,
                    submittedAt: serverTimestamp(),
                }),
        };

        await setDoc(
            submissionRef,
            data,
            { merge: true }
        );

        return {
            id: studentId,
            assignmentId,
            ...submissionData,
        };
    } catch (error) {
        console.error("Error submitting assignment:", error);
        throw error;
    }
};

// ------------------------------------------------------------
// GET STUDENT SUBMISSION
// ------------------------------------------------------------
export const getStudentSubmission = async (
    assignmentId,
    studentId
) => {
    try {
        if (!assignmentId || !studentId) {
            return null;
        }

        const submissionRef = doc(
            db,
            "assignments",
            assignmentId,
            "submissions",
            studentId
        );

        const snapshot = await getDoc(
            submissionRef
        );

        if (!snapshot.exists()) {
            return null;
        }

        return {
            id: snapshot.id,
            assignmentId,
            ...snapshot.data(),
        };
    } catch (error) {
        console.error(
            "Error getting student submission:",
            error
        );

        throw error;
    }
};

// ------------------------------------------------------------
// GET ALL SUBMISSIONS FOR ASSIGNMENT
// ------------------------------------------------------------
export const getAssignmentSubmissions = async (
    assignmentId
) => {
    try {
        const submissionsRef = collection(
            db,
            "assignments",
            assignmentId,
            "submissions"
        );

        const snapshot = await getDocs(
            submissionsRef
        );

        return snapshot.docs.map((submissionDoc) => ({
            id: submissionDoc.id,
            assignmentId,
            ...submissionDoc.data(),
        }));
    } catch (error) {
        console.error(
            "Error getting assignment submissions:",
            error
        );

        throw error;
    }
};

// ------------------------------------------------------------
// GRADE SUBMISSION
// ------------------------------------------------------------
export const gradeSubmission = async (
    assignmentId,
    studentId,
    grade,
    feedback,
    teacherId
) => {
    try {
        const submissionRef = doc(
            db,
            "assignments",
            assignmentId,
            "submissions",
            studentId
        );

        await updateDoc(submissionRef, {
            grade,
            feedback: feedback || "",
            gradedAt: serverTimestamp(),
            gradedBy: teacherId,
            updatedAt: serverTimestamp(),
        });

        return true;
    } catch (error) {
        console.error("Error grading submission:", error);
        throw error;
    }
};

// ------------------------------------------------------------
// GET MY ASSIGNMENTS
// ------------------------------------------------------------
//
// courseIds = array of course IDs the student is enrolled in
//
// Only published assignments are returned.
// ------------------------------------------------------------
export const getMyAssignments = async (courseIds = []) => {
    try {
        if (!Array.isArray(courseIds) || courseIds.length === 0) {
            return [];
        }

        const assignments = [];

        for (const courseId of courseIds) {
            const q = query(
                collection(db, "assignments"),
                where("courseId", "==", courseId),
                where("status", "==", "published")
            );

            const snapshot = await getDocs(q);

            snapshot.docs.forEach((assignmentDoc) => {
                assignments.push({
                    id: assignmentDoc.id,
                    ...assignmentDoc.data(),
                });
            });
        }

        // Remove accidental duplicates.
        const uniqueAssignments = Array.from(
            new Map(
                assignments.map((assignment) => [
                    assignment.id,
                    assignment,
                ])
            ).values()
        );

        // Sort by due date when available.
        uniqueAssignments.sort((a, b) => {
            const aDate = getDateValue(a.dueDate);
            const bDate = getDateValue(b.dueDate);

            if (aDate === null && bDate === null) return 0;
            if (aDate === null) return 1;
            if (bDate === null) return -1;

            return aDate - bDate;
        });

        return uniqueAssignments;
    } catch (error) {
        console.error("Error getting my assignments:", error);
        throw error;
    }
};

// ------------------------------------------------------------
// HELPER: DATE VALUE
// ------------------------------------------------------------
const getDateValue = (value) => {
    if (!value) {
        return null;
    }

    if (typeof value?.toDate === "function") {
        return value.toDate().getTime();
    }

    if (value instanceof Date) {
        return value.getTime();
    }

    const parsed = new Date(value).getTime();

    return Number.isNaN(parsed) ? null : parsed;
};