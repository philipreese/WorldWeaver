"""Compile supplied GLSL ES shader pairs using Mesa EGL, with no browser or pip dependency."""
import ctypes as C
import json
import os
import sys

os.environ.setdefault("EGL_PLATFORM", "surfaceless")
os.environ.setdefault("LIBGL_ALWAYS_SOFTWARE", "1")
egl = C.CDLL("libEGL.so.1")
pointer, uint, integer = C.c_void_p, C.c_uint, C.c_int
integer_pointer = C.POINTER(integer)


def api(name, result, *args):
    function = getattr(egl, name)
    function.restype, function.argtypes = result, args
    return function


get_display = api("eglGetDisplay", pointer, pointer)
initialize = api("eglInitialize", uint, pointer, integer_pointer, integer_pointer)
bind_api = api("eglBindAPI", uint, uint)
choose_config = api("eglChooseConfig", uint, pointer, integer_pointer, C.POINTER(pointer), integer, integer_pointer)
create_context = api("eglCreateContext", pointer, pointer, pointer, pointer, integer_pointer)
make_current = api("eglMakeCurrent", uint, pointer, pointer, pointer, pointer)
get_proc = api("eglGetProcAddress", pointer, C.c_char_p)
destroy_context = api("eglDestroyContext", uint, pointer, pointer)
terminate = api("eglTerminate", uint, pointer)

display = get_display(None)
major, minor = integer(), integer()
if not initialize(display, C.byref(major), C.byref(minor)) or not bind_api(0x30A0):
    raise RuntimeError("EGL ES initialization failed; install libegl1 and libgl1-mesa-dri.")
attributes = (integer * 9)(0x3040, 0x40, 0x3033, 1, 0x3024, 8, 0x3023, 8, 0x3038)
config, count = pointer(), integer()
if not choose_config(display, attributes, C.byref(config), 1, C.byref(count)) or not count.value:
    raise RuntimeError("No EGL ES 3 configuration.")
context = create_context(display, config, None, (integer * 3)(0x3098, 3, 0x3038))
if not context or not make_current(display, None, None, context):
    raise RuntimeError("Cannot create an EGL ES 3 context.")


def gl(name, result, *args):
    address = get_proc(name.encode())
    if not address:
        raise RuntimeError(f"Missing GL function {name}")
    return C.CFUNCTYPE(result, *args)(address)


get_string = gl("glGetString", C.c_char_p, uint)
create_shader = gl("glCreateShader", uint, uint)
shader_source = gl("glShaderSource", None, uint, integer, C.POINTER(C.c_char_p), integer_pointer)
compile_shader = gl("glCompileShader", None, uint)
shader_parameter = gl("glGetShaderiv", None, uint, uint, integer_pointer)
shader_log = gl("glGetShaderInfoLog", None, uint, integer, integer_pointer, pointer)
delete_shader = gl("glDeleteShader", None, uint)
create_program = gl("glCreateProgram", uint)
attach_shader = gl("glAttachShader", None, uint, uint)
link_program = gl("glLinkProgram", None, uint)
program_parameter = gl("glGetProgramiv", None, uint, uint, integer_pointer)
program_log = gl("glGetProgramInfoLog", None, uint, integer, integer_pointer, pointer)
delete_program = gl("glDeleteProgram", None, uint)

report = {
    "renderer": get_string(0x1F01).decode(),
    "version": get_string(0x1F02).decode(),
    "programs": [],
}
try:
    for pair in json.load(sys.stdin):
        program, shaders = create_program(), []
        entry = {"name": pair["name"], "errors": []}
        for stage, enum in [("vertex", 35633), ("fragment", 35632)]:
            shader = create_shader(enum)
            shaders.append(shader)
            raw = C.c_char_p(pair[stage].encode())
            shader_source(shader, 1, C.byref(raw), None)
            compile_shader(shader)
            status = integer()
            shader_parameter(shader, 0x8B81, C.byref(status))
            attach_shader(program, shader)
            if not status.value:
                log = C.create_string_buffer(16000)
                shader_log(shader, len(log), None, log)
                entry["errors"].append({"stage": stage, "log": log.value.decode(errors="replace")})
        link_program(program)
        status = integer()
        program_parameter(program, 0x8B82, C.byref(status))
        if not status.value:
            log = C.create_string_buffer(16000)
            program_log(program, len(log), None, log)
            entry["errors"].append({"stage": "link", "log": log.value.decode(errors="replace")})
        entry["passed"] = not entry["errors"]
        report["programs"].append(entry)
        delete_program(program)
        for shader in shaders:
            delete_shader(shader)
finally:
    make_current(display, None, None, None)
    destroy_context(display, context)
    terminate(display)
print(json.dumps(report, indent=2))
sys.exit(0 if report["programs"] and all(item["passed"] for item in report["programs"]) else 1)
