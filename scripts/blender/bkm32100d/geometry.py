"""Small bpy primitives. Public coordinates are runtime (cross, up, forward), in metres."""
import math
import bpy
import bmesh
from mathutils import Vector


def xyz(point):
    x, up, forward = point
    return (x, -forward, up)


def collection(name):
    result = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(result)
    return result


def empty(name, parent, coll, position=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    coll.objects.link(obj)
    obj.parent = parent
    obj.location = xyz(position)
    obj.empty_display_type = 'PLAIN_AXES'
    obj.empty_display_size = 0.15
    return obj


def material(name, color, roughness=0.45, metallic=0.0, alpha=1.0, emission=0.0):
    rgb = tuple(int(color[i:i + 2], 16) / 255 for i in (1, 3, 5))
    # Hex colours describe display/sRGB; shader inputs are linear.
    rgb = tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in rgb)
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, alpha)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*rgb, alpha)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Alpha'].default_value = alpha
    if emission:
        shader.inputs['Emission Color'].default_value = (*rgb, 1)
        shader.inputs['Emission Strength'].default_value = emission
    if alpha < 1:
        mat.surface_render_method = 'DITHERED'
    return mat


def mesh(name, vertices, faces, mat, parent, coll, smooth=False, bevel=0):
    data = bpy.data.meshes.new(name + '-mesh')
    data.from_pydata([xyz(v) for v in vertices], [], faces)
    data.update()
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(data)
    bm.free()
    obj = bpy.data.objects.new(name, data)
    coll.objects.link(obj)
    obj.parent = parent
    if mat:
        data.materials.append(mat)
    for face in data.polygons:
        face.use_smooth = smooth
    if bevel:
        modifier = obj.modifiers.new('Editable edge radii', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 3
        modifier.limit_method = 'ANGLE'
        modifier.harden_normals = True
        normal = obj.modifiers.new('Panel normals', 'WEIGHTED_NORMAL')
        normal.keep_sharp = True
    return obj


def box(name, dimensions, center, mat, parent, coll, bevel=0.015):
    w, h, d = dimensions
    x, y, z = center
    vertices = [(x + a * w / 2, y + b * h / 2, z + c * d / 2)
                for a, b, c in [(-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1),
                                (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)]]
    return mesh(name, vertices, [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
                                 (3, 7, 6, 2), (0, 4, 7, 3), (1, 2, 6, 5)],
                mat, parent, coll, bevel=min(bevel, min(dimensions) / 3))


def profile(name, points, width, x, mat, parent, coll, bevel=0.015):
    """Extrude a (forward, up) outline across X; supports concave wheel openings."""
    vertices = [(x + side * width / 2, up, forward) for side in (-1, 1) for forward, up in points]
    count = len(points)
    faces = [tuple(range(count - 1, -1, -1)), tuple(range(count, count * 2))]
    faces += [(i, (i + 1) % count, (i + 1) % count + count, i + count) for i in range(count)]
    return mesh(name, vertices, faces, mat, parent, coll, bevel=bevel)


def cylinder(name, radius, depth, center, mat, parent, coll, axis='y', segments=24):
    x, y, z = center
    vertices = []
    for length in (-depth / 2, depth / 2):
        for i in range(segments):
            a = i * math.tau / segments
            u, v = radius * math.cos(a), radius * math.sin(a)
            p = (length, u, v) if axis == 'x' else (u, length, v) if axis == 'y' else (u, v, length)
            vertices.append((x + p[0], y + p[1], z + p[2]))
    faces = [tuple(range(segments - 1, -1, -1)), tuple(range(segments, segments * 2))]
    faces += [(i, (i + 1) % segments, (i + 1) % segments + segments, i + segments) for i in range(segments)]
    obj = mesh(name, vertices, faces, mat, parent, coll, smooth=True)
    obj.data.polygons[0].use_smooth = False
    obj.data.polygons[1].use_smooth = False
    return obj


def rod(name, a, b, radius, mat, parent, coll, segments=12):
    direction = Vector(xyz(b)) - Vector(xyz(a))
    obj = cylinder(name, radius, direction.length, (0, 0, 0), mat, parent, coll, segments=segments)
    obj.location = (Vector(xyz(a)) + Vector(xyz(b))) * 0.5
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = direction.to_track_quat('Z', 'Y')
    return obj


def lathe_x(name, points, center, mat, parent, coll, segments=32):
    x, y, z = center
    vertices = []
    for radius, offset in points:
        vertices += [(x + offset, y + math.sin(i * math.tau / segments) * radius,
                      z + math.cos(i * math.tau / segments) * radius) for i in range(segments)]
    faces = []
    for row in range(len(points) - 1):
        for i in range(segments):
            a = row * segments + i
            b = row * segments + (i + 1) % segments
            faces.append((a, b, b + segments, a + segments))
    return mesh(name, vertices, faces, mat, parent, coll, smooth=True)
