package pptxdev

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestClient_Validate(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/validate" {
			http.NotFound(w, r)
			return
		}
		if r.Method != http.MethodPost {
			http.Error(w, "method", http.StatusMethodNotAllowed)
			return
		}
		if got := r.Header.Get("Authorization"); got != "Bearer test-key" {
			t.Errorf("Authorization = %q", got)
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(ValidateResponse{
			Valid:    true,
			Errors:   nil,
			Warnings: nil,
		})
	}))
	t.Cleanup(srv.Close)

	cl, err := NewClient("test-key", WithBaseURL(srv.URL))
	if err != nil {
		t.Fatal(err)
	}
	opf := json.RawMessage(`{"$schema":"https://pptx.dev/schema/opf/v1","meta":{"title":"T"},"design":{"theme":"corporate-minimal"},"slides":[]}`)
	res, err := cl.Validate(context.Background(), opf)
	if err != nil {
		t.Fatal(err)
	}
	if !res.Valid {
		t.Fatalf("expected valid")
	}
}

func TestClient_Generate_Opferror(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/generate" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Request-Id", "req_header")
		w.WriteHeader(http.StatusUnprocessableEntity)
		_ = json.NewEncoder(w).Encode(APIErrorResponse{
			Error: APIErrorEnvelope{
				Code:      "invalid_request",
				Message:   "Invalid OPF document",
				RequestID: "req_body",
				Details: mustRawJSON(t, ValidationErrorDetails{
					Errors: []ValidationIssue{
						{Path: "$.slides", Message: "At least one slide is required"},
					},
				}),
			},
		})
	}))
	t.Cleanup(srv.Close)

	cl, err := NewClient("", WithBaseURL(srv.URL))
	if err != nil {
		t.Fatal(err)
	}
	_, err = cl.Generate(context.Background(), "pptx", json.RawMessage(`{}`))
	var ov *OpfValidationError
	if err == nil {
		t.Fatal("expected error")
	}
	if !errors.As(err, &ov) {
		t.Fatalf("expected OpfValidationError, got %T %v", err, err)
	}
	if ov.Code != "invalid_request" || ov.RequestID != "req_header" || len(ov.ValidationErrors) != 1 {
		t.Fatalf("detail: %+v", ov)
	}
	if ov.ValidationErrors[0].Path != "$.slides" {
		t.Fatalf("validation errors: %+v", ov.ValidationErrors)
	}
}

func mustRawJSON(t *testing.T, value any) json.RawMessage {
	t.Helper()
	body, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	return body
}

func TestJoinIntsComma(t *testing.T) {
	t.Parallel()
	if got := joinIntsComma([]int{1, 3, 5}); got != "1,3,5" {
		t.Fatalf("got %q", got)
	}
}

func TestClient_ParsePPTX_multipart(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/parse" {
			http.NotFound(w, r)
			return
		}
		if !strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/form-data") {
			http.Error(w, "want multipart", http.StatusBadRequest)
			return
		}
		if err := r.ParseMultipartForm(1 << 20); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		f, _, err := r.FormFile("file")
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		defer f.Close()
		body, _ := io.ReadAll(f)
		if string(body) != "PK\x03\x04fake" {
			http.Error(w, "bad file", http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(ParseAcceptedResponse{
			ParseID:    "abc",
			SlideCount: 2,
			Width:      100,
			Height:     50,
		})
	}))
	t.Cleanup(srv.Close)

	cl, err := NewClient("", WithBaseURL(srv.URL))
	if err != nil {
		t.Fatal(err)
	}
	res, err := cl.ParsePPTX(context.Background(), "deck.pptx", strings.NewReader("PK\x03\x04fake"))
	if err != nil {
		t.Fatal(err)
	}
	if res.ParseID != "abc" || res.SlideCount != 2 {
		t.Fatalf("%+v", res)
	}
}
