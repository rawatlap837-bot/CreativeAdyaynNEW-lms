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
} from "../lib/database";

import { auth, db } from "../lib/backend";

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

        const existingData = existingSubmission.exists()
            ? existingSubmission.data()
            : {};

        const data = {
            ...submissionData,
            studentId,

            // Always send protected grading fields so Supabase database rules can
            // validate resubmissions consistently, including older records.
            grade: existingData.grade ?? null,
            feedback: existingData.feedback ?? "",
            gradedAt: existingData.gradedAt ?? null,
            gradedBy: existingData.gradedBy ?? null,

            updatedAt: serverTimestamp(),

            ...(existingSubmission.exists()
                ? { submittedAt: existingData.submittedAt ?? serverTimestamp() }
                : { submittedAt: serverTimestamp() }),
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
            let courseName = "";

            try {
                const courseSnapshot = await getDoc(
                    doc(db, "courses", courseId)
                );

                if (courseSnapshot.exists()) {
                    const course = courseSnapshot.data();
                    courseName =
                        course.title ||
                        course.courseName ||
                        "";
                }
            } catch (courseError) {
                console.warn(
                    `Failed to load course name for ${courseId}:`,
                    courseError
                );
            }

            const q = query(
                collection(db, "assignments"),
                where("courseId", "==", courseId),
                where("status", "==", "published")
            );

            const snapshot = await getDocs(q);

            const courseAssignments = snapshot.docs.map((assignmentDoc) => ({
                id: assignmentDoc.id,
                courseName,
                ...assignmentDoc.data(),
            }));

            const visibleAssignments = await Promise.all(
                courseAssignments.map(async (assignment) => {
                    if (!assignment.targetBatchId) return assignment;

                    try {
                        const batchSnapshot = await getDoc(
                            doc(db, "batches", assignment.targetBatchId)
                        );

                        const studentIds = batchSnapshot.exists()
                            ? batchSnapshot.data().studentIds
                            : [];

                        return Array.isArray(studentIds) &&
                            studentIds.includes(auth.currentUser?.uid)
                            ? assignment
                            : null;
                    } catch {
                        return null;
                    }
                })
            );

            assignments.push(
                ...visibleAssignments.filter(Boolean)
            );
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

        // Show the newest published assignments first.
        uniqueAssignments.sort((a, b) => {
            const aCreatedAt = getDateValue(a.createdAt);
            const bCreatedAt = getDateValue(b.createdAt);

            if (aCreatedAt !== null || bCreatedAt !== null) {
                if (aCreatedAt === null) return 1;
                if (bCreatedAt === null) return -1;

                return bCreatedAt - aCreatedAt;
            }

            // Keep a predictable order for legacy records without createdAt.
            const aDueDate = getDateValue(a.dueDate);
            const bDueDate = getDateValue(b.dueDate);

            if (aDueDate === null && bDueDate === null) return 0;
            if (aDueDate === null) return 1;
            if (bDueDate === null) return -1;

            return aDueDate - bDueDate;
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