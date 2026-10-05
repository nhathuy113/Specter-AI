package main

import (
	"context"
	"errors"
	"os"
	"reflect"
	"testing"
)

func TestScreencaptureArgs(t *testing.T) {
	for _, display := range []int{0, 1, 2} {
		index := "1"
		if display == 2 {
			index = "2"
		}
		want := []string{"-x", "-D", index, "/tmp/a.png"}
		if got := screencaptureArgs(display, "/tmp/a.png"); !reflect.DeepEqual(got, want) {
			t.Fatalf("display %d: got %v; want %v", display, got, want)
		}
	}
}

func TestCaptureCleansTemporaryFile(t *testing.T) {
	for _, fail := range []bool{false, true} {
		var file string
		png, err := capturePNGWithRunner(context.Background(), 2, func(_ context.Context, args []string) error {
			file = args[len(args)-1]
			if fail {
				return errors.New("permission denied")
			}
			return os.WriteFile(file, pngSignature, 0600)
		})
		if fail && err == nil {
			t.Fatal("expected capture failure")
		}
		if !fail && (err != nil || !reflect.DeepEqual(png, pngSignature)) {
			t.Fatalf("capture: %v", err)
		}
		if _, err := os.Stat(file); !os.IsNotExist(err) {
			t.Fatal("temporary file was not removed")
		}
	}
}

func TestCaptureRejectsInvalidOutputAndCancelledContext(t *testing.T) {
	_, err := capturePNGWithRunner(context.Background(), 1, func(_ context.Context, args []string) error {
		return os.WriteFile(args[len(args)-1], []byte("not PNG"), 0600)
	})
	if err == nil {
		t.Fatal("expected invalid PNG rejection")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err = capturePNGWithRunner(ctx, 1, func(context.Context, []string) error { t.Fatal("cancelled capture ran"); return nil })
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context cancellation: %v", err)
	}
	_, err = capturePNGWithRunner(context.Background(), -1, func(context.Context, []string) error { t.Fatal("invalid display ran"); return nil })
	if err == nil {
		t.Fatal("expected invalid display rejection")
	}
}
