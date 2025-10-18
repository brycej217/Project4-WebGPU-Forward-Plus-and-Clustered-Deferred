import * as renderer from "../renderer";
import * as shaders from "../shaders/shaders";
import { Stage } from "../stage/stage";

const texFormat = "rgba16float";

export class ClusteredDeferredRenderer extends renderer.Renderer {
  // TODO-3: add layouts, pipelines, textures, etc. needed for Forward+ here
  // you may need extra uniforms such as the camera view matrix and the canvas resolution

  // G-buffer
  posTexture: GPUTexture;
  posTextureView: GPUTextureView;

  normalTexture: GPUTexture;
  normalTextureView: GPUTextureView;

  albedoTexture: GPUTexture;
  albedoTextureView: GPUTextureView;

  sampler: GPUSampler;

  GBufferBindGroupLayout: GPUBindGroupLayout;
  GBufferBindGroup: GPUBindGroup;
  GBufferPipeline: GPURenderPipeline;

  // fullscreen
  fullscreenBindGroupLayout: GPUBindGroupLayout;
  fullscreenBindGroup: GPUBindGroup;
  fullscreenPipeline: GPURenderPipeline;

  depthTexture: GPUTexture;
  depthTextureView: GPUTextureView;

  constructor(stage: Stage) {
    super(stage);

    // TODO-3: initialize layouts, pipelines, textures, etc. needed for Forward+ here
    // you'll need two pipelines: one for the G-buffer pass and one for the fullscreen pass

    // create textures
    this.posTexture = renderer.device.createTexture({
      size: [renderer.canvas.width, renderer.canvas.height],
      format: texFormat,
      usage:
        GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.posTextureView = this.posTexture.createView();

    this.normalTexture = renderer.device.createTexture({
      size: [renderer.canvas.width, renderer.canvas.height],
      format: texFormat,
      usage:
        GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.normalTextureView = this.normalTexture.createView();

    this.albedoTexture = renderer.device.createTexture({
      size: [renderer.canvas.width, renderer.canvas.height],
      format: texFormat,
      usage:
        GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.albedoTextureView = this.albedoTexture.createView();

    this.depthTexture = renderer.device.createTexture({
      size: [renderer.canvas.width, renderer.canvas.height],
      format: "depth24plus",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.depthTextureView = this.depthTexture.createView();

    // create sampler
    this.sampler = renderer.device.createSampler({
      magFilter: "nearest",
      minFilter: "nearest",
    });

    // g buffer pass
    this.GBufferBindGroupLayout = renderer.device.createBindGroupLayout({
      label: "clustered deffered bind group layout",
      entries: [
        {
          // camera
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "uniform" },
        },
      ],
    });

    this.GBufferBindGroup = renderer.device.createBindGroup({
      label: "cluster deffered bind group",
      layout: this.GBufferBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.camera.uniformsBuffer },
        },
      ],
    });

    this.GBufferPipeline = renderer.device.createRenderPipeline({
      layout: renderer.device.createPipelineLayout({
        label: "g buffer pipeline layout",
        bindGroupLayouts: [
          this.GBufferBindGroupLayout,
          renderer.modelBindGroupLayout,
          renderer.materialBindGroupLayout,
        ],
      }),
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth24plus",
      },
      vertex: {
        module: renderer.device.createShaderModule({
          label: "clustered deffered vert shader",
          code: shaders.naiveVertSrc,
        }),
        buffers: [renderer.vertexBufferLayout],
      },
      fragment: {
        module: renderer.device.createShaderModule({
          label: "clustered deffered frag shader",
          code: shaders.clusteredDeferredFragSrc,
        }),
        targets: [
          {
            format: texFormat, // pos texture
          },
          {
            format: texFormat, // normal texture
          },
          {
            format: texFormat, // albedo texture
          },
        ],
      },
    });

    // fullscreen pass
    this.fullscreenBindGroupLayout = renderer.device.createBindGroupLayout({
      label: "clustered deffered fullscreen bind group layout",
      entries: [
        {
          // camera
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
        {
          // lightSet
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "read-only-storage" },
        },
        {
          // cluster array
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "storage" },
        },
        {
          // light index array
          binding: 3,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "storage" },
        },
        {
          // pos tex
          binding: 4,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {},
        },
        {
          // normal tex
          binding: 5,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {},
        },
        {
          // albedo tex
          binding: 6,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {},
        },
        {
          // sampler
          binding: 7,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},
        },
      ],
    });

    this.fullscreenBindGroup = renderer.device.createBindGroup({
      label: "clustered deferred fullscreen bind group",
      layout: this.fullscreenBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.camera.uniformsBuffer },
        },
        {
          binding: 1,
          resource: { buffer: this.lights.lightSetStorageBuffer },
        },
        {
          // cluster light indices
          binding: 2,
          resource: { buffer: this.lights.clusterBuffer },
        },
        {
          // light index buffer
          binding: 3,
          resource: { buffer: this.lights.lightIndicesBuffer },
        },
        {
          // pos tex
          binding: 4,
          resource: this.posTextureView,
        },
        {
          // normal tex
          binding: 5,
          resource: this.normalTextureView,
        },
        {
          // albedo tex
          binding: 6,
          resource: this.albedoTextureView,
        },
        {
          binding: 7,
          resource: this.sampler,
        },
      ],
    });

    this.fullscreenPipeline = renderer.device.createRenderPipeline({
      layout: renderer.device.createPipelineLayout({
        label: "clustered deffered fullscreen pipeline layout",
        bindGroupLayouts: [this.fullscreenBindGroupLayout],
      }),
      vertex: {
        module: renderer.device.createShaderModule({
          label: "fullscreen vert shader",
          code: shaders.clusteredDeferredFullscreenVertSrc,
        }),
      },
      fragment: {
        module: renderer.device.createShaderModule({
          label: "fullscreen frag shader",
          code: shaders.clusteredDeferredFullscreenFragSrc,
        }),
        targets: [
          {
            format: renderer.canvasFormat,
          },
        ],
      },
    });
  }

  override draw() {
    // TODO-3: run the Forward+ rendering pass:
    // - run the clustering compute shader
    // - run the G-buffer pass, outputting position, albedo, and normals
    // - run the fullscreen pass, which reads from the G-buffer and performs lighting calculations
    const encoder = renderer.device.createCommandEncoder();
    const canvasTextureView = renderer.context.getCurrentTexture().createView();

    // compute pass
    this.lights.doLightClustering(encoder);

    // G-Buffer pass
    const gBufferRenderPass = encoder.beginRenderPass({
      label: "g buffer render pass",
      colorAttachments: [
        {
          view: this.posTextureView,
          clearValue: [0, 0, 0, 1],
          loadOp: "clear",
          storeOp: "store",
        },
        {
          view: this.normalTextureView,
          clearValue: [0, 0, 0, 1],
          loadOp: "clear",
          storeOp: "store",
        },
        {
          view: this.albedoTextureView,
          clearValue: [0, 0, 0, 1],
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: this.depthTextureView,
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });
    gBufferRenderPass.setPipeline(this.GBufferPipeline);
    gBufferRenderPass.setBindGroup(0, this.GBufferBindGroup);

    this.scene.iterate(
      (node) =>
        gBufferRenderPass.setBindGroup(
          shaders.constants.bindGroup_model,
          node.modelBindGroup
        ),
      (material) =>
        gBufferRenderPass.setBindGroup(
          shaders.constants.bindGroup_material,
          material.materialBindGroup
        ),
      (primitive) => {
        gBufferRenderPass.setVertexBuffer(0, primitive.vertexBuffer);
        gBufferRenderPass.setIndexBuffer(primitive.indexBuffer, "uint32");
        gBufferRenderPass.drawIndexed(primitive.numIndices);
      }
    );

    gBufferRenderPass.end();

    // graphics pass
    const fullscreenRenderPass = encoder.beginRenderPass({
      label: "fullscreen render pass",
      colorAttachments: [
        {
          view: canvasTextureView,
          clearValue: [0, 0, 0, 0],
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    fullscreenRenderPass.setPipeline(this.fullscreenPipeline);

    fullscreenRenderPass.setBindGroup(
      shaders.constants.bindGroup_scene,
      this.fullscreenBindGroup
    );
    fullscreenRenderPass.draw(6);

    fullscreenRenderPass.end();

    renderer.device.queue.submit([encoder.finish()]);
  }
}
